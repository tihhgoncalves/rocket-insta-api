<p align="center">
  <img src="https://media.tenor.com/GVbLnw73qD8AAAAi/dancing-duck-karlo.gif" width="150" alt="Rocket Insta API">
</p>

# Rocket Insta API

O **Rocket Insta API** é um cliente não-oficial da API privada do Instagram para Node.js, escrito em TypeScript, com melhorias e extensões exclusivas da [Rocket Produtora Digital](https://www.produtorarocket.com).  

Este projeto permite interações avançadas com o Instagram, como postagem de fotos, stories, mensagens diretas, e agora também traz recursos modernos como **publicações com curtidas ocultas**.

[![Último Commit](https://img.shields.io/github/last-commit/tihhgoncalves/rocket-insta-api.svg?style=flat)]()
[![Licença MIT](https://img.shields.io/badge/Licença-MIT-yellow.svg)](https://opensource.org/licenses/)
[![Contribuidores do GitHub](https://img.shields.io/github/contributors/tihhgoncalves/rocket-insta-api.svg?style=flat)]()

---

> 🚀 Este projeto é um **fork oficial do [`instagram-private-api`](https://github.com/dilame/instagram-private-api)**, com propósito de continuidade, atualização e adição de recursos que não existem na versão original.

>📘 **Documentação em Português (PT-BR)**  
> Este projeto está documentado em português brasileiro.  
> Caso queira contribuir com uma versão em inglês, será muito bem-vindo! 🇧🇷


---

## Principais Recursos

- ✅ Upload de fotos, vídeos e álbuns
- ✅ Envio de mensagens diretas
- ✅ Publicação de Stories
- ✅ Comentários, curtidas e interações
- 🆕 **Publicação com curtidas ocultas** (em desenvolvimento)
- 🛠️ Simulação completa de fluxo de login e sessão

---

## Instalação

```bash
npm install tihhgoncalves/rocket-insta-api
````

---

## Exemplo de uso

```ts
import { IgApiClient } from 'rocket-insta-api';

const ig = new IgApiClient();
ig.state.generateDevice('seu_usuario');

(async () => {
  await ig.account.login('SEU_USUARIO', 'SENHA');

  await ig.publish.photo({
    file: await readFileAsync('foto.jpg'),
    caption: 'Post com Rocket ✨',
    hideLikeAndViewCounts: true, // funcionalidade em testes!
  });
})();
```

---

## Contribuições

Ideias, sugestões e PRs são muito bem-vindos!
Se você quiser sugerir melhorias ou reportar bugs, abra uma [issue](https://github.com/tihhgoncalves/rocket-insta-api/issues).

---

## Mantenedor

Este projeto é mantido pela **[Rocket Produtora Digital](https://www.produtorarocket.com)**
Desenvolvido com 💙 por [Tihh Gonçalves](https://github.com/tihhgoncalves)

[![GitHub](https://img.shields.io/badge/GitHub-181717.svg?style=for-the-badge\&logo=github\&logoColor=white)](https://github.com/tihhgoncalves)
[![Telegram](https://img.shields.io/badge/Telegram-26A5E4.svg?style=for-the-badge\&logo=telegram\&logoColor=white)](https://t.me/seutelegram)

---

## Licença

Código aberto sob licença [MIT](https://opensource.org/licenses/MIT).