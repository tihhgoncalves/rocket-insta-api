import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { InstagramBrowser } from '../src/instagram.mjs';
import { loadRecipe } from '../src/recipe.mjs';

const recipe = () => loadRecipe(fileURLToPath(new URL('../examples/feed.json', import.meta.url)), 'feed');
test('conta incorreta impede busca e upload', async () => {
  const client = new InstagramBrowser();
  client.navigate = async () => {};
  client.viewer = async () => ({ id: '123', username: 'other' });
  client.lookup = async () => assert.fail('Não deve consultar perfis');
  client.request = async () => assert.fail('Não deve publicar');
  await assert.rejects(client.publish(await recipe()), /Execute login/);
});
test('falha na resolução de menção impede qualquer escrita', async () => {
  const client = new InstagramBrowser();
  client.assertAccount = async () => {};
  client.lookup = async () => { throw new Error('ID indisponível'); };
  client.request = async () => assert.fail('Não deve publicar');
  await assert.rejects(client.publish(await recipe()), /ID indisponível/);
});
test('upload recusado não é seguido por configure nem repetição', async () => {
  const client = new InstagramBrowser();
  client.assertAccount = async () => {};
  client.lookup = async username => ({ username, id: '123456789' });
  client.page = { evaluate: async () => ({ width: 1920, height: 1200 }) };
  const requests = [];
  client.request = async path => { requests.push(path); throw new Error('Upload recusado'); };
  await assert.rejects(client.publish(await recipe()), /Upload recusado/);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /^\/rupload_igphoto\//);
});
test('transporte recusa destinos externos antes de ler a sessão', async () => {
  const client = new InstagramBrowser();
  await assert.rejects(client.request('https://example.com/'), /Caminho de publicação inválido/);
});
