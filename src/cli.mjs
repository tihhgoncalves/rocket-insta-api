#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { InstagramBrowser } from './instagram.mjs';
import { loadRecipe } from './recipe.mjs';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  account: { type: 'string', default: process.env.IG_USERNAME },
  publish: { type: 'boolean', default: false },
  headless: { type: 'boolean', default: true },
  headed: { type: 'boolean', default: false },
  manual: { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
} });
const [command, input] = positionals;
const help = `Rocket Insta API — 0.0.1 beta
  npm run login -- --account seu_usuario
  npm run lookup -- usuario_exemplo
  npm run inspect
  npm run feed -- examples/feed.json             (prévia local)
  npm run feed -- examples/feed.json --publish   (publica uma foto)
  npm run story -- examples/story.json --publish (publica um story)
  Headless por padrão. Login: IG_USERNAME e IG_PASSWORD no ambiente ou .env.
  --headed --manual permite login visual apenas para desenvolvimento local.
`;

async function main() {
  if (values.help || !command) return console.log(help);
  if (!['login', 'lookup', 'inspect', 'feed', 'story'].includes(command)) throw new Error(help);
  let recipe;
  if (command === 'feed' || command === 'story') {
    if (!input) throw new Error('Informe o caminho do arquivo JSON de publicação.');
    recipe = await loadRecipe(input, command);
    console.log(JSON.stringify({ mode: values.publish ? 'publish' : 'preview', ...recipe }, null, 2));
    if (!values.publish) return;
  }
  if (command === 'lookup' && !input) throw new Error('Informe o username.');
  const client = new InstagramBrowser({ headless: !values.headed, profileDir: process.env.IG_PROFILE_DIR });
  try {
    await client.open();
    if (command === 'login') {
      console.error(`Login pelo console. Conta esperada: @${values.account}.`);
      const requestCode = process.stdin.isTTY ? async ({ signal }) => {
        const terminal = createInterface({ input: process.stdin, output: process.stderr });
        try { return await terminal.question('Código recebido pelo método de verificação da conta: ', { signal }); }
        finally { terminal.close(); }
      } : undefined;
      console.log(JSON.stringify({ loggedIn: await client.login({
        account: values.account, username: process.env.IG_USERNAME || values.account,
        password: process.env.IG_PASSWORD, manual: values.manual, timeout: values.manual ? 600000 : 120000,
        requestCode, onEvent: event => console.error(JSON.stringify(event)),
      }) }, null, 2));
    } else if (command === 'lookup') {
      await client.assertAccount(values.account);
      const profile = await client.lookup(input);
      console.log(JSON.stringify({ profile, screenshot: await client.screenshot('lookup') }, null, 2));
    } else if (command === 'inspect') {
      await client.navigate('/');
      console.log(JSON.stringify(await client.inspect(), null, 2));
    } else {
      const result = await client.publish(recipe);
      // A publicação já aconteceu: falha de screenshot nunca deve incentivar um novo envio.
      let screenshot = null;
      let verification = null;
      try {
        if (command === 'feed') verification = await client.verifyFeed(result.url, recipe);
        else verification = await client.verifyStory(result.url, recipe);
        screenshot = await client.screenshot(command);
      } catch { verification = { confirmed: false, message: 'Confira o link antes de repetir a publicação.' }; }
      console.log(JSON.stringify({ publication: result, verification, screenshot }, null, 2));
    }
  } catch (error) {
    if (error.code === 'SECURITY_CHALLENGE' || error.code === 'CODE_REQUIRED') {
      try { console.error(JSON.stringify({ diagnosticScreenshot: await client.screenshot('auth-challenge') })); } catch { /* erro original preservado */ }
    }
    throw error;
  } finally { await client.close(); }
}
main().catch(error => { console.error(JSON.stringify({ error: error.code || 'OPERATION_FAILED', message: error.message })); process.exitCode = 1; });
