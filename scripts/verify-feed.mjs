// Somente leitura e interação visual de tags; nunca publica conteúdo.
import { InstagramBrowser } from '../src/instagram.mjs';
import { loadRecipe } from '../src/recipe.mjs';

const [url, recipePath] = process.argv.slice(2);
if (!url || !recipePath) throw new Error('Use: node scripts/verify-feed.mjs URL arquivo.json');
const recipe = await loadRecipe(recipePath, 'feed');
const client = new InstagramBrowser();
try {
  await client.open();
  const verification = await client.verifyFeed(url, recipe);
  console.log(JSON.stringify({ url, verification, screenshot: await client.screenshot('feed-verified') }, null, 2));
} finally { await client.close(); }
