import test from 'node:test';
import assert from 'node:assert/strict';
import { InstagramBrowser } from '../src/instagram.mjs';

function mock(state, { authenticated = false } = {}) {
  const client = new InstagramBrowser();
  const entries = [];
  let submitted = false;
  client.browser = { connected: true };
  client.navigate = async () => {};
  client.viewer = async () => (authenticated || submitted) ? { username: 'example', id: '123' } : null;
  client.page = {
    evaluate: async () => state,
    locator: selector => ({
      fill: async value => entries.push({ selector, value }),
      click: async () => { submitted = true; },
    }),
  };
  return { client, entries };
}
test('sessão salva funciona headless sem reenviar credenciais', async () => {
  const { client, entries } = mock({}, { authenticated: true });
  const events = [];
  await client.login({ account: 'example', onEvent: event => events.push(event) });
  assert.equal(client.options.headless, true);
  assert.deepEqual(entries, []);
  assert.deepEqual(events, [{ event: 'authenticated', reusedSession: true }]);
});
test('login preenche os campos uma vez e não inclui senha nos eventos', async () => {
  const { client, entries } = mock({ state: 'credentials', username: '[name=email]', password: '[name=pass]', submit: '[type=submit]' });
  const events = [];
  await client.login({ account: 'example', password: 'secret-password', onEvent: event => events.push(event) });
  assert.equal(entries.length, 2);
  assert.equal(entries[1].value, 'secret-password');
  assert.equal(JSON.stringify(events).includes('secret-password'), false);
});
test('código de verificação pode ser solicitado por callback do console', async () => {
  const { client, entries } = mock({ state: 'code_required', code: '[name=code]', submit: '[type=submit]' });
  let prompts = 0;
  await client.login({ account: 'example', requestCode: async () => { prompts++; return '123456'; } });
  assert.equal(prompts, 1);
  assert.deepEqual(entries, [{ selector: '[name=code]', value: '123456' }]);
});
test('sem TTY, código requerido gera erro acionável', async () => {
  const { client } = mock({ state: 'code_required' });
  await assert.rejects(client.login({ account: 'example' }), { code: 'CODE_REQUIRED' });
});
test('sem credenciais falha sem tentar submit', async () => {
  const { client, entries } = mock({ state: 'credentials' });
  await assert.rejects(client.login({ account: 'example' }), { code: 'CREDENTIALS_REQUIRED' });
  assert.equal(entries.length, 0);
});
test('bloqueios e desafios não geram tentativas automáticas', async () => {
  for (const [state, code] of [['rate_limited', 'RATE_LIMITED'], ['security_challenge', 'SECURITY_CHALLENGE'],
    ['visual_challenge', 'SECURITY_CHALLENGE'], ['invalid_credentials', 'INVALID_CREDENTIALS'], ['invalid_code', 'INVALID_VERIFICATION_CODE']]) {
    const { client, entries } = mock({ state });
    await assert.rejects(client.login({ account: 'example', password: 'secret' }), { code });
    assert.equal(entries.length, 0);
  }
});
test('login manual não é permitido sem interface', async () => {
  const { client } = mock({});
  await assert.rejects(client.login({ account: 'example', manual: true }), { code: 'MANUAL_REQUIRES_WINDOW' });
});
