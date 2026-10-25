import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProfile, extractViewer, normalizeUsername } from '../src/profile.mjs';

function fixture(username = 'example', id = '12345678901234567890') {
  return { initialRouteInfo: { route: { actorID: '999', url: `/${username}/`, params: { username },
    rootView: { props: { id, page_logging: { name: 'profilePage', params: { profile_id: id, page_id: `profilePage_${id}` } } } } } } };
}
test('perfil correto, ID longo e conta autenticada separada', () => {
  assert.deepEqual(extractProfile([{ require: [fixture()], viewer: { id: '999', username: 'owner' } }], ' @Example '),
    { id: '12345678901234567890', username: 'example' });
});
test('não aceita outro username, ID solto, rota divergente ou JSON malformado', () => {
  assert.equal(extractProfile([fixture('other')], 'example'), null);
  assert.equal(extractProfile([{ id: '123', username: 'example' }], 'example'), null);
  const route = fixture(); route.initialRouteInfo.route.url = '/other/';
  assert.equal(extractProfile([route], 'example'), null);
  assert.equal(extractProfile([{ initialRouteInfo: { route: { params: { username: 123 } } } }], 'example'), null);
});
test('rejeita IDs conflitantes e números sem precisão', () => {
  assert.throws(() => extractProfile([fixture('example', '123'), fixture('example', '456')], 'example'), /conflitantes/);
  assert.equal(extractProfile([fixture('example', 12345678901234567890)], 'example'), null);
});
test('identidade depende do ID do cookie e de username inequívoco', () => {
  const data = [{ id: '999', username: 'owner' }, { id: '123', username: 'target' }];
  assert.deepEqual(extractViewer(data, '999'), { id: '999', username: 'owner' });
  assert.equal(extractViewer(data, '000'), null);
  assert.equal(extractViewer([...data, { id: '999', username: 'other' }], '999'), null);
});
test('username inválido é recusado antes da navegação', () => {
  for (const input of ['../bad', '@@bad', '', 'bad name', null]) assert.throws(() => normalizeUsername(input));
});
