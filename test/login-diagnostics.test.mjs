import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAuthResponse, summarizeLogin } from '../src/login-diagnostics.mjs';
import { InstagramBrowser } from '../src/instagram.mjs';
import { EventEmitter } from 'node:events';

test('respostas de login viram categorias sem reproduzir o conteúdo remoto', () => {
  const cases = [
    [429, {}, 'rate_limited'],
    [200, { two_factor_required: true, two_factor_info: { identifier: 'private-token' } }, 'code_required'],
    [400, { checkpoint_url: '/challenge/private-token' }, 'security_challenge'],
    [200, { message: 'incorrect_password private-token' }, 'invalid_credentials'],
    [200, { authenticated: true, userId: 'private-token' }, 'authenticated_response'],
    [200, { authenticated: false, message: 'private-token' }, 'login_rejected'],
    [200, { errors: [{ message: 'checkpoint_required private-token' }] }, 'security_challenge'],
    [200, null, 'unclassified'],
  ];
  for (const [httpStatus, data, expected] of cases) {
    const result = classifyAuthResponse(httpStatus, data);
    assert.equal(result.outcome, expected);
    assert.equal(JSON.stringify(result).includes('private-token'), false);
    assert.deepEqual(Object.keys(result).sort(), ['httpStatus', 'outcome', 'source']);
  }
});

test('resumo reconhece sinais silenciosos e não confunde cookie com sessão confirmada', () => {
  assert.equal(summarizeLogin({ page: {}, sessionCookiePresent: true, userIdCookiePresent: true }).classification, 'session_unverified');
  assert.equal(summarizeLogin({ page: { alertPresent: true } }).classification, 'feedback_present');
  assert.equal(summarizeLogin({ page: { approvalPromptPresent: true } }).classification, 'approval_required');
  assert.equal(summarizeLogin({ page: { codePromptPresent: true } }).classification, 'verification_pending');
  assert.equal(summarizeLogin({ page: {}, frameSecurityPresent: true }).classification, 'security_challenge');
  assert.equal(summarizeLogin({ page: {}, state: 'credentials' }).classification, 'login_form_still_present');
});

test('resumo ignora texto, URLs, seletores e campos arbitrários', () => {
  const summary = summarizeLogin({
    state: 'private-token', page: { route: '/private-token', html: 'private-token', alertPresent: true },
    responses: [{ httpStatus: 200, source: 'private-token', outcome: 'private-token', body: 'private-token' }],
  });
  assert.equal(JSON.stringify(summary).includes('private-token'), false);
});

test('timeout guarda diagnóstico sem reenviar as credenciais', async () => {
  const client = new InstagramBrowser();
  let clicks = 0;
  const events = [];
  const state = { state: 'credentials', username: '#user', password: '#pass', submit: '#submit' };
  client.browser = { connected: true };
  client.navigate = async () => {};
  client.viewer = async () => null;
  client.page = {
    evaluate: async () => state,
    locator: () => ({ fill: async () => {}, click: async () => { clicks++; } }),
    waitForFunction: async () => ({ jsonValue: async () => state, dispose: async () => {} }),
  };
  client.captureLoginDiagnostics = async observedState => summarizeLogin({ state: observedState, page: {} });
  await assert.rejects(client.login({ account: 'example', password: 'synthetic-secret', timeout: 50,
    onEvent: event => events.push(event) }), error => error.code === 'LOGIN_TIMEOUT' &&
      error.diagnostics.classification === 'login_form_still_present');
  assert.equal(clicks, 1);
  assert.equal(client.getLastLoginDiagnostics().classification, 'login_form_still_present');
  assert.equal(JSON.stringify(events).includes('synthetic-secret'), false);
  assert.ok(events.some(event => event.event === 'login_diagnostic'));
});

test('resposta de login recusada é classificada sem repetir o clique', async () => {
  const client = new InstagramBrowser();
  const page = new EventEmitter();
  let clicks = 0;
  const events = [];
  const state = { state: 'credentials', username: '#user', password: '#pass', submit: '#submit' };
  page.evaluate = async () => state;
  page.locator = () => ({ fill: async () => {}, click: async () => {
    clicks++;
    page.emit('response', {
      url: () => 'https://www.instagram.com/api/v1/web/accounts/login/ajax/',
      request: () => ({ method: () => 'POST' }), status: () => 200,
      json: async () => ({ authenticated: false, message: 'private-token' }),
    });
  } });
  page.waitForFunction = async () => ({ jsonValue: async () => state, dispose: async () => {} });
  client.page = page;
  client.browser = { connected: true };
  client.navigate = async () => {};
  client.viewer = async () => null;
  client.captureLoginDiagnostics = async (observedState, responses) => summarizeLogin({ state: observedState, page: {}, responses });
  await assert.rejects(client.login({ account: 'example', password: 'synthetic-secret',
    onEvent: event => events.push(event) }), { code: 'LOGIN_REJECTED' });
  assert.equal(clicks, 1);
  assert.equal(client.getLastLoginDiagnostics().classification, 'login_rejected');
  assert.equal(page.listenerCount('response'), 0);
  assert.doesNotMatch(JSON.stringify(events), /private-token|synthetic-secret/);
});
