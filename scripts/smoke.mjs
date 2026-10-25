// Valida o Chrome/Puppeteer local em HTML sintético, sem acessar o Instagram.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { extractProfile } from '../src/profile.mjs';
import { readLoginState, fillAndSubmit } from '../src/auth.mjs';

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
  console.log(JSON.stringify({ browser: await browser.version(), renderedProfileParser: 'ok', cookieApi: 'ok',
    loginForm: 'ok', verificationForm: 'ok', network: 'no Instagram requests' }, null, 2));
} finally { await browser.close(); }
