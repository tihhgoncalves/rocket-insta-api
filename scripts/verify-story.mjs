// Verifica um story existente sem publicar novamente.
import { InstagramBrowser } from '../src/instagram.mjs';
import { loadRecipe } from '../src/recipe.mjs';

const [url, recipePath] = process.argv.slice(2);
if (!url || !recipePath) throw new Error('Use: node scripts/verify-story.mjs URL arquivo.json');
const recipe = await loadRecipe(recipePath, 'story');
const client = new InstagramBrowser();
try {
  await client.open();
  const verification = await client.verifyStory(url, recipe);
  console.log(JSON.stringify({ url, verification, screenshot: await client.screenshot('story-verified') }, null, 2));
} finally { await client.close(); }
