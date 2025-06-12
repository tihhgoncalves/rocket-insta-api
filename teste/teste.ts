import { IgApiClient } from '../src';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import 'dotenv/config';

const ig = new IgApiClient();
ig.state.generateDevice(process.env.IG_USERNAME!);

const stateFilePath = './state.json';

(async () => {
  // Se já existir um state salvo, usamos ele pra evitar login
  if (existsSync(stateFilePath)) {
    const savedState = JSON.parse(readFileSync(stateFilePath, 'utf-8'));
    await ig.state.deserialize(savedState);
    console.log('🔐 Sessão restaurada com sucesso');
  } else {
    await ig.simulate.preLoginFlow();
    await ig.account.login(process.env.IG_USERNAME!, process.env.IG_PASSWORD!);
    const serialized = await ig.state.serialize();
    writeFileSync(stateFilePath, JSON.stringify(serialized));
    console.log('🔐 Login realizado e sessão salva');
  }

  const image = readFileSync('./foto.png');

  await ig.publish.photo({
    file: image,
    caption: 'Post com curtidas ocultas via Rocket 🚀',
    hideLikeAndViewCounts: true,
  });

  console.log('✅ Post publicado com sucesso!');
})();
