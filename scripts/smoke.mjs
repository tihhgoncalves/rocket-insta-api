// Valida o Chrome/Puppeteer local em HTML sintético, sem acessar o Instagram.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { extractProfile } from '../src/profile.mjs';
import { readLoginState, fillAndSubmit } from '../src/auth.mjs';
import { loginFixtures } from './auth-fixtures.mjs';
import { InstagramBrowser } from '../src/instagram.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, unlink } from 'node:fs/promises';

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  const data = { initialRouteInfo: { route: {
    url: '/example/', params: { username: 'example' },
    rootView: { props: { id: '12345678901234567890', page_logging: {
      name: 'profilePage', params: { profile_id: '12345678901234567890', page_id: 'profilePage_12345678901234567890' },
    } } },
  } } };
  await page.setContent(`<html><script type="application/json">${JSON.stringify(data)}</script></html>`);
  const documents = await page.evaluate(() => [...document.querySelectorAll('script[type="application/json"]')].map(s => JSON.parse(s.textContent)));
  assert.deepEqual(extractProfile(documents, 'example'), { id: '12345678901234567890', username: 'example' });
  assert.ok(Array.isArray(await browser.cookies()));
  await page.setContent('<input name="email"><input name="pass" type="password"><div role="button" tabindex="0" aria-label="Entrar" onclick="document.body.dataset.submitted=\'yes\'">Entrar</div>');
  const loginState = await page.evaluate(readLoginState);
  assert.equal(loginState.state, 'credentials');
  await fillAndSubmit(page, loginState, { username: 'example', password: 'synthetic-password' });
  assert.equal(await page.evaluate(() => document.body.dataset.submitted), 'yes');
  await page.setContent('<form onsubmit="event.preventDefault();document.body.dataset.submitted=\'code\'"><input name="verificationCode"><button type="submit">Confirmar</button></form>');
  const codeState = await page.evaluate(readLoginState);
  assert.equal(codeState.state, 'code_required');
  await fillAndSubmit(page, codeState, { code: '123456' });
  assert.equal(await page.evaluate(() => document.body.dataset.submitted), 'code');
  for (const fixture of loginFixtures) {
    await page.setContent(fixture.html);
    const fields = await page.evaluate(readLoginState);
    assert.equal(fields.state, 'credentials', fixture.name);
    if (fixture.initialSubmitMissing) assert.equal(fields.submit, null, fixture.name);
    try {
      await fillAndSubmit(page, fields, { username: 'example', password: 'synthetic-password' });
    } catch (error) {
      throw new Error(`Fixture: ${fixture.name}. ${error.message}`);
    }
    assert.equal(await page.evaluate(() => document.body.dataset.submitted), 'yes', fixture.name);
  }
  // Botões com o mesmo nome sem formulário inequívoco não devem ser escolhidos.
  await page.setContent('<input name="email"><input name="pass" type="password"><button>Log in</button><button>Log in</button>');
  assert.equal((await page.evaluate(readLoginState)).submit, null);
  const diagnosticClient = new InstagramBrowser({ profileDir: resolve(fileURLToPath(new URL('../', import.meta.url)), '.local/diagnostics-smoke') });
  diagnosticClient.browser = browser;
  diagnosticClient.page = page;
  await page.setContent('<div role="alert">private-token private-contact</div><input name="password" type="text" value="synthetic-secret">');
  const diagnostic = await diagnosticClient.captureLoginDiagnostics('credentials', []);
  assert.equal(diagnostic.classification, 'feedback_present');
  const saved = await readFile(diagnostic.artifacts.json, 'utf8');
  assert.doesNotMatch(saved, /private-token|private-contact|synthetic-secret/);
  assert.ok((await readFile(diagnostic.artifacts.screenshot)).length > 0);
  assert.ok(await page.evaluate(() => document.body.innerText.includes('private-token')));
  // A captura não altera a página original nem inclui seu conteúdo.
  await unlink(diagnostic.artifacts.json);
  await unlink(diagnostic.artifacts.screenshot);
  for (const fixture of [
    { html: '<p>Verification code</p><input inputmode="numeric" maxlength="6"><button>Confirm</button>', state: 'code_required' },
    { html: '<p>Check another device to approve your login</p>', state: 'approval_required' },
    { html: '<p>Enviamos um código de verificação</p>', state: 'verification_pending' },
    { html: '<p>Save your login info</p>', state: 'post_login_prompt' },
  ]) {
    await page.setContent(fixture.html);
    assert.equal((await page.evaluate(readLoginState)).state, fixture.state);
  }
  console.log(JSON.stringify({ browser: await browser.version(), renderedProfileParser: 'ok', cookieApi: 'ok',
    loginForm: 'ok', verificationForm: 'ok', loginVariants: loginFixtures.length,
    ambiguousButtons: 'rejected', sanitizedDiagnostic: 'ok', postSubmitStates: 'ok', network: 'no Instagram requests' }, null, 2));
} finally { await browser.close(); }
