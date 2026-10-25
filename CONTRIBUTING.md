# Contribuindo

Leia as [convenções do projeto](AGENTS.md) antes de alterar o código.

## Preparação

Use Node.js 22 ou superior e instale as dependências com `npm ci`.
O [README](README.md) descreve a instalação do Chrome, a configuração local e os comandos disponíveis.

Os testes automatizados não exigem credenciais ou conta do Instagram:

```sh
npm test
npm run check
```

Se alterar formulários ou integração com o navegador, execute também:

```sh
npm exec puppeteer browsers install chrome
npm run test:browser
```

Esse último teste usa HTML sintético. Não publica nem consulta perfis reais.

## Enviando alterações

- Explique o problema, o comportamento final e como foi validado.
- Inclua testes de regressão quando houver mudança de comportamento.
- Use exemplos fictícios; não envie credenciais, sessões ou capturas de contas reais.
- Descreva limitações conhecidas e diferencie testes simulados de validações reais.
- Preserve o template do README e o padrão de código existente.
- Evite mudanças de versão, dependências ou formatação sem relação com a tarefa.

Não execute publicações reais apenas para validar uma contribuição. As prévias
de `feed` e `story`, sem `--publish`, permitem revisar uma receita sem enviar conteúdo.
