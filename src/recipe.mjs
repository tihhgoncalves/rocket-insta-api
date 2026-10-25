import { resolve, dirname } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { normalizeUsername } from './profile.mjs';

export async function loadRecipe(path, kind) {
  const absolute = resolve(path);
  const raw = JSON.parse(await readFile(absolute, 'utf8'));
  if (!['feed', 'story'].includes(kind)) throw new Error('Tipo de publicação inválido.');
  const account = normalizeUsername(raw.account);
  if (typeof raw.image !== 'string') throw new Error('Informe image no arquivo de publicação.');
  const image = resolve(dirname(absolute), raw.image);
  const info = await stat(image);
  if (!info.isFile() || info.size > 20 * 1024 * 1024) throw new Error('Use uma imagem JPEG de até 20 MB.');
  const bytes = await readFile(image);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('O protótipo aceita somente imagens JPEG.');
  if (typeof raw.caption !== 'undefined' && typeof raw.caption !== 'string') throw new Error('caption deve ser texto.');
  const caption = raw.caption ?? '';
  if (caption.length > 2200) throw new Error('Legenda excede 2.200 caracteres.');
  function users(field) {
    const values = raw[field] ?? [];
    if (!Array.isArray(values)) throw new Error(`${field} deve ser uma lista.`);
    return [...new Set(values.map(normalizeUsername))];
  }
  const mentions = users('mentions');
  const collaborators = users('collaborators');
  if (kind === 'story' && collaborators.length) throw new Error('Stories não aceitam colaboradores.');
  if (mentions.length + collaborators.length > 20) throw new Error('Limite do protótipo: 20 marcações no total.');
  return { kind, account, image, caption, mentions, collaborators,
    hideLikes: raw.hideLikes === true, disableComments: raw.disableComments === true };
}
