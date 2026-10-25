<img src="https://raw.githubusercontent.com/filipedeschamps/rss-feed-emitter/master/content/logo.gif">

# 🚀 Rocket Insta API

Uma biblioteca em Node.js para integrar de forma simples com o Instagram usando Puppeteer, sessão persistente e execução sem interface gráfica.

[![Versão Beta](https://img.shields.io/badge/vers%C3%A3o-0.0.1--beta-orange.svg?style=flat)](CHANGELOG.md)
[![Último Commit](https://img.shields.io/github/last-commit/tihhgoncalves/rocket-insta-api.svg?style=flat)](https://github.com/tihhgoncalves/rocket-insta-api/commits)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933.svg?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Contribuidores do GitHub](https://img.shields.io/github/contributors/tihhgoncalves/rocket-insta-api.svg?style=flat)](https://github.com/tihhgoncalves/rocket-insta-api/graphs/contributors)
[![Licença MIT](https://img.shields.io/badge/Licen%C3%A7a-MIT-yellow.svg)](LICENSE)

---

## 📥 Instalação

Com Node.js 22 ou superior instalado, execute na pasta do projeto:

```sh
npm ci
npm exec puppeteer browsers install chrome
```

Copie `.env.example` para `.env` e configure suas credenciais localmente:

```env
IG_USERNAME=seu_usuario
IG_PASSWORD=sua_senha
```

O arquivo `.env`, a sessão do navegador e as capturas locais ficam fora do Git.

---

## 📚 Principais Funcionalidades

- Login automático com reaproveitamento da sessão.
- Consulta de perfis e IDs pelo nome de usuário.
- Publicação de fotos no feed com legenda e marcações.
- Convites de colaboração em publicações.
- Publicação de stories com menções interativas.
- Execução headless, adequada para terminal e VPS.
- Verificação de publicações e diagnóstico sanitizado.

A versão **0.0.1 está em beta**. A integração oferece biblioteca JavaScript e CLI; servidor HTTP, fila e agendamento ainda não estão implementados.

---

## ⚙️ Uso Básico

### Pelo terminal

```sh
# Autenticar e salvar a sessão
npm run login

# Importar uma sessão autenticada: os valores serão pedidos em entrada oculta
npm run import-cookies -- --account seu_usuario

# Consultar o ID de um perfil
npm run lookup -- usuario_exemplo

# Conferir os dados de uma publicação, sem enviar
npm run feed -- examples/feed.json

# Publicar uma foto com marcação
npm run feed -- examples/feed.json --publish

# Publicar uma foto com convite de colaboração
npm run feed -- examples/collab.json --publish

# Publicar um story com menção
npm run story -- examples/story.json --publish
```

Antes de publicar, ajuste a conta, a imagem, a legenda e os usuários nos arquivos de exemplo. Cada execução envia no máximo uma imagem; sem `--publish`, os comandos de publicação exibem somente uma prévia local.

### Como biblioteca

```js
import { InstagramBrowser, loadRecipe } from './src/index.mjs';

process.loadEnvFile('.env');

const insta = await new InstagramBrowser().open();

try {
  await insta.login({
    account: process.env.IG_USERNAME,
    password: process.env.IG_PASSWORD,
  });

  const user = await insta.lookup('usuario_exemplo');
  console.log(user); // { id: '...', username: 'usuario_exemplo' }

  const recipe = await loadRecipe('examples/feed.json', 'feed');
  const result = await insta.publish(recipe);
  console.log(result.url);
} finally {
  await insta.close();
}
```

### Arquivo de publicação

```json
{
  "account": "seu_usuario",
  "image": "../assets/test.jpg",
  "caption": "Minha legenda!",
  "mentions": ["usuario_exemplo"],
  "collaborators": [],
  "hideLikes": false,
  "disableComments": false
}
```

Para collab, informe os usuários em `collaborators`. Para stories, use `mentions`; colaboradores não são aceitos. Os caminhos de imagem são relativos ao arquivo JSON. Nesta beta, o formato aceito é JPEG de até 20 MB, enviado sem redimensionamento.

---

## 🖥️ Terminal e VPS

### Importar uma sessão por cookies

Como alternativa ao envio de senha, importe os cookies de uma sessão já autenticada. Execute `npm run import-cookies -- --account seu_usuario` e cole, **no prompt oculto**, um JSON em uma única linha com este formato:

```json
{"sessionid":"VALOR_DA_SESSAO","csrftoken":"VALOR_CSRF","ds_user_id":"123456789"}
```

Os valores reais não devem ser digitados no comando do shell, em opções da CLI nem em arquivos versionados. A leitura também aceita um JSON fornecido por stdin até EOF, para integração com uma fonte segura; não é necessário criar arquivo intermediário. A entrada é limitada a 32 KiB.

Na biblioteca, use `await insta.importCookies(cookies, { account: 'seu_usuario' })` depois de `open()`. O método aceita o objeto acima ou uma lista restrita de objetos `name`/`value` com atributos de cookie. Rejeita nomes extras, duplicados, valores inválidos, domínios externos, URLs não oficiais, caminhos diferentes de `/` e atributos inseguros.

Os três cookies são instalados para `.instagram.com`, raiz `/`, com `secure: true`; `sessionid` é HttpOnly. Sem expiração fornecida, a persistência local é limitada a sete dias. Isso não prolonga a validade da sessão no servidor. Uma expiração explícita válida é preservada; `expires: -1` indica cookie de sessão.

A importação abre a página inicial apenas para leitura e confere username e ID. Não publica nem submete senha. Se a conta divergir, a sessão não for confirmada ou houver falha, tenta restaurar os três cookies anteriores. Valores de cookies nunca são retornados, impressos ou gravados em relatórios; o perfil persistente do Chrome armazena a sessão e deve permanecer protegido.

Depois de confirmada a importação, `login()` reutiliza a sessão válida antes de considerar qualquer senha. Cookies expirados ou recusados ainda podem exigir reautenticação ou verificação do Instagram. Esta funcionalidade tem testes sem rede e validação de atributos em navegador com cookies sintéticos; a importação real no PRD deve ser validada separadamente.

O navegador funciona em modo headless por padrão. Configure `IG_PROFILE_DIR` para usar um diretório persistente de sessão e execute um processo por perfil de navegador.

No Linux, instale as bibliotecas de sistema exigidas pelo Chrome e execute com usuário próprio, preservando o sandbox. Consulte o [guia oficial do Puppeteer](https://pptr.dev/troubleshooting) para os requisitos da distribuição. Faça o primeiro login no próprio VPS.

Se o Instagram apresentar um formulário de código compatível, a CLI solicita o código no terminal interativo. Na biblioteca, use o callback `requestCode`. CAPTCHA e outros desafios visuais interrompem o fluxo com diagnóstico; não são resolvidos automaticamente.

O login aguarda o botão de envio aparecer e ficar habilitado após preencher os campos, por até 15 segundos. Se o formulário continuar indisponível ou houver botões ambíguos, retorna `FORM_CHANGED` sem clicar. Um clique que falhar não é repetido automaticamente.

Após o envio, os eventos `login_state` e `login_response` informam somente categorias conhecidas. Em caso de timeout, `login_diagnostic` e `error.diagnostics` incluem indicadores como código pendente, aprovação em outro dispositivo, resposta recusada ou cookies presentes sem sessão confirmada. Na biblioteca, `getLastLoginDiagnostics()` também retorna esse diagnóstico, quando disponível.

O relatório JSON e a imagem sanitizada são gravados em `rocket-diagnostics/`, dentro do diretório do perfil, quando houver permissão de escrita. A imagem mostra um painel local com os indicadores permitidos; **não fotografa a página original**. Não inclui conteúdo da tela, campos preenchidos, mensagens remotas, URLs completas nem valores de cookies. Se o relatório não puder ser gravado, o erro original é preservado. Não há reenvio da senha para gerar o diagnóstico.

Para desenvolvimento local com janela visível:

```sh
npm run login -- --headed --manual
```

As publicações não são repetidas automaticamente. Se uma operação ficar sem confirmação, confira o perfil antes de executar novamente. Convites de colaboração dependem da aceitação do destinatário; menções em stories criam uma área clicável, sem desenhar texto na imagem.

---

## 🧪 Testes e Diagnóstico

```sh
npm test
npm run check
npm run test:browser
npm run inspect
```

Os testes automatizados usam dados fictícios e não publicam conteúdo. O teste de navegador usa HTML sintético. O comando `inspect` acessa a sessão e mostra somente nomes e atributos dos cookies, método, caminho e status das chamadas observadas.

Capturas ficam em `.local/screenshots/`, ignoradas pelo Git. Senhas, tokens, valores de cookies e corpos das requisições não são impressos nos diagnósticos. Proteja `.env` e `.local/` com permissões restritas no servidor.

Login automático, busca de IDs, feed com marcação, convite de collab e story com menção foram validados localmente em modo headless. A validação em VPS Linux e a autenticação real com código de verificação continuam pendentes.

---

## 🙌 Contribuições

Contribuições são bem-vindas! Abra uma [issue](https://github.com/tihhgoncalves/rocket-insta-api/issues) para relatar problemas ou sugerir melhorias.

Consulte o [guia de contribuição](CONTRIBUTING.md) e as [convenções do projeto](AGENTS.md) para desenvolvimento, testes e cuidados com a sessão.

---

## 👨‍💻 Mantenedor

Este projeto é mantido por [Tihh Gonçalves](https://github.com/tihhgoncalves).

---

## 🔗 Redes e Contato

[![GitHub](https://img.shields.io/badge/GitHub-181717.svg?style=for-the-badge&logo=GitHub&logoColor=white)](https://github.com/tihhgoncalves)
[![Telegram](https://img.shields.io/badge/Telegram-26A5E4.svg?style=for-the-badge&logo=Telegram&logoColor=white)](https://t.me/tihhgoncalves)

---

## 🚀 Rocket Produtora Digital

Criado com ♥ pela [Rocket Produtora Digital](https://www.produtorarocket.com)

---

## 📄 Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
