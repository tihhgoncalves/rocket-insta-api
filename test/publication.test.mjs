import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadRecipe } from '../src/recipe.mjs';
import { buildPublication } from '../src/payload.mjs';

const recipePath = name => fileURLToPath(new URL(`../examples/${name}.json`, import.meta.url));
const users = new Map([['usuario_exemplo', { username: 'usuario_exemplo', id: '123456789' }]]);
test('exemplos usam a imagem de teste na raiz do projeto', async () => {
  for (const kind of ['feed', 'story']) {
    const recipe = await loadRecipe(recipePath(kind), kind);
    assert.equal(recipe.image, fileURLToPath(new URL('../assets/test.jpg', import.meta.url)));
  }
});
test('feed envia marcação; collab envia convite e não duplica a marcação', async () => {
  const recipe = await loadRecipe(recipePath('collab'), 'feed');
  recipe.mentions = [...recipe.collaborators];
  const { path, form } = buildPublication(recipe, users, '123');
  assert.equal(path, '/api/v1/media/configure/');
  assert.deepEqual(JSON.parse(form.invite_coauthor_user_ids_string), ['123456789']);
  assert.equal(JSON.parse(form.usertags).in.length, 1);
});
test('story usa endpoint e geometria corretos', async () => {
  const recipe = await loadRecipe(recipePath('story'), 'story');
  const { path, form } = buildPublication(recipe, users, '123');
  assert.equal(path, '/api/v1/media/configure_to_story/');
  assert.equal(form.configure_mode, '1');
  assert.deepEqual(JSON.parse(form.reel_mentions), [{ user_id: '123456789', x: 0.5, y: 0.5, width: 0.5, height: 0.1, rotation: 0 }]);
  assert.equal(form.invite_coauthor_user_ids_string, undefined);
});
test('nenhuma publicação é montada com ID ausente ou perfil divergente', async () => {
  const recipe = await loadRecipe(recipePath('feed'), 'feed');
  assert.throws(() => buildPublication(recipe, new Map(), '123'), /não confirmado/);
  assert.throws(() => buildPublication(recipe, new Map([['usuario_exemplo', { username: 'other', id: '123' }]]), '123'), /não confirmado/);
});
