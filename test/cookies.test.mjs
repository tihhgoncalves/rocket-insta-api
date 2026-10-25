import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSessionCookies, parseCookieInput } from '../src/cookies.mjs';
import { InstagramBrowser } from '../src/instagram.mjs';
import { readSecretInput } from '../src/secret-input.mjs';
import { Readable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';

const input = () => ({ sessionid: 'synthetic-session%3Avalue', csrftoken: 'synthetic-csrf', ds_user_id: '123456789' });

test('cookies usam domínio restrito, HTTPS, raiz e atributos seguros', () => {
  const cookies = normalizeSessionCookies(input(), 1000000);
  for (const cookie of cookies) {
    assert.equal(cookie.domain, '.instagram.com');
    assert.equal(cookie.path, '/');
    assert.equal(cookie.secure, true);
    assert.equal(cookie.httpOnly, cookie.name === 'sessionid');
    assert.equal(cookie.sameSite, 'None');
    assert.equal(cookie.expires, 1000 + 7 * 86400);
  }
  assert.equal(cookies[0].value, input().sessionid); // Não decodificar sessionid.
});

test('rejeita cookies incompletos, duplicados, expirados e atributos fora do escopo', () => {
  const array = () => Object.entries(input()).map(([name, value]) => ({ name, value }));
  const cases = [null, {}, { ...input(), extra: 'unexpected' }, { ...input(), ds_user_id: 'not-numeric' },
    { ...input(), sessionid: 'private-token\r\nheader' }, { ...input(), csrftoken: '' },
    [...array().slice(0, 2), array()[0]],
  ];
  for (const changes of [
    { domain: '.example.com' }, { domain: '.instagram.com.example.com' }, { url: 'https://example.com/' },
    { url: 'http://www.instagram.com/' }, { url: 'https://www.instagram.com/?token=private-token' },
    { path: '/other' }, { secure: false }, { httpOnly: false }, { expires: 1 }, { partitionKey: 'unexpected' },
  ]) { const cookies = array(); Object.assign(cookies[0], changes); cases.push(cookies); }
  for (const value of cases) assert.throws(() => normalizeSessionCookies(value), error =>
    error.code === 'INVALID_COOKIES' && !error.message.includes('private-token'));
  assert.throws(() => parseCookieInput('{ private-token'), error => error.code === 'INVALID_COOKIES' && !error.message.includes('private-token'));
});

test('cookies associados à origem oficial são aceitos sem estender validade explícita', () => {
  const cookies = Object.entries(input()).map(([name, value]) => ({ name, value, url: 'https://www.instagram.com/', expires: 2000 }));
  assert.equal(normalizeSessionCookies(cookies, 1000000)[0].expires, 2000);
});

function fakeClient(viewer = { username: 'example', id: '123456789' }) {
  const client = new InstagramBrowser();
  let jar = [];
  let navigations = 0;
  client.browser = {
    cookies: async () => jar.map(cookie => ({ ...cookie })),
    setCookie: async (...cookies) => { jar.push(...cookies); },
    deleteCookie: async (...cookies) => { jar = jar.filter(cookie => !cookies.some(remove => remove.name === cookie.name && remove.domain === cookie.domain)); },
    connected: true,
  };
  client.page = {};
  client.navigate = async () => { navigations++; };
  client.viewer = async () => viewer;
  return { client, jar: () => jar, navigations: () => navigations };
}

test('importação confirma username/ID e login reutiliza a sessão sem preencher senha', async () => {
  const { client, navigations } = fakeClient();
  client.page.evaluate = async () => assert.fail('Não deve ler formulário nem submeter senha');
  const imported = await client.importCookies(input(), { account: '@example' });
  assert.deepEqual(imported, { username: 'example', id: '123456789' });
  assert.equal(navigations(), 1);
  const events = [];
  await client.login({ account: 'example', password: 'must-not-submit', onEvent: event => events.push(event) });
  assert.deepEqual(events, [{ event: 'authenticated', reusedSession: true }]);
  assert.doesNotMatch(JSON.stringify({ imported, events }), /synthetic-session|synthetic-csrf|must-not-submit/);
});

test('conta divergente ou sessão expirada restaura os cookies anteriores', async () => {
  for (const viewer of [null, { username: 'other', id: '123456789' }, { username: 'example', id: '999' }]) {
    const { client, jar } = fakeClient(viewer);
    const previous = normalizeSessionCookies({ ...input(), sessionid: 'old-session' });
    await client.browser.setCookie(...previous);
    await assert.rejects(client.importCookies(input(), { account: 'example' }), error =>
      ['COOKIE_ACCOUNT_MISMATCH', 'COOKIE_SESSION_UNCONFIRMED'].includes(error.code));
    assert.equal(jar().find(cookie => cookie.name === 'sessionid').value, 'old-session');
  }
});

test('entrada por pipe é limitada e não é ecoada', async () => {
  const output = { write: () => assert.fail('Não deve ecoar dados de pipe') };
  const text = JSON.stringify(input());
  assert.equal(await readSecretInput(Readable.from([text]), output), text);
  await assert.rejects(readSecretInput(Readable.from(['x'.repeat(32769)]), output), { code: 'COOKIE_INPUT_TOO_LARGE' });
});

test('CLI rejeita cookies em argumentos sem imprimir seu conteúdo', () => {
  for (const args of [['import-cookies', 'private-token'], ['import-cookies', '--sessionid=private-token']]) {
    const child = spawnSync(process.execPath, ['src/cli.mjs', ...args], { encoding: 'utf8' });
    assert.equal(child.status, 1);
    assert.doesNotMatch(child.stdout + child.stderr, /private-token/);
  }
});

test('TTY oculta a entrada e restaura o modo do terminal', async () => {
  const stream = new EventEmitter();
  stream.isTTY = true;
  stream.isRaw = false;
  stream.setRawMode = value => { stream.isRaw = value; };
  stream.pause = () => {};
  stream.resume = () => {};
  let shown = '';
  const promise = readSecretInput(stream, { write: value => { shown += value; } });
  const secret = JSON.stringify(input());
  stream.emit('data', Buffer.from(secret + '\r'));
  assert.equal(await promise, secret);
  assert.equal(stream.isRaw, false);
  assert.doesNotMatch(shown, /synthetic-session|synthetic-csrf/);
});

test('TTY recusa colagem excessiva mesmo quando termina com Enter', async () => {
  const stream = new EventEmitter();
  Object.assign(stream, { isTTY: true, isRaw: false, setRawMode: () => {}, pause: () => {}, resume: () => {} });
  const promise = readSecretInput(stream, { write: () => {} });
  stream.emit('data', Buffer.from('x'.repeat(32769) + '\r'));
  await assert.rejects(promise, { code: 'COOKIE_INPUT_TOO_LARGE' });
});
