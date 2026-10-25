# Convenções do Rocket Insta API

Estas instruções se aplicam a todo o repositório. Siga primeiro as instruções
explícitas do usuário na conversa.

## Contexto e escopo

- Projeto Node.js com Puppeteer, biblioteca JavaScript e CLI. Não reintroduzir PHP.
- Node.js 22 ou superior, módulos ESM em arquivos `.mjs`, npm e `package-lock.json`.
- Headless é o padrão, inclusive para login. Interface gráfica é opcional para desenvolvimento local.
- A versão atual é beta. Não apresentar testes locais como validação em VPS Linux.
- Servidor HTTP, fila e agendador não fazem parte do escopo atual. Não adicioná-los sem uma tarefa que os solicite.

## Organização

- `src/index.mjs`: interface pública da biblioteca.
- `src/instagram.mjs`: ciclo de vida do navegador, sessão e operações do Instagram.
- `src/auth.mjs`: estados e interação com os formulários de autenticação.
- `src/profile.mjs`: normalização de usernames e extração de identidade/ID.
- `src/recipe.mjs`: leitura e validação das receitas de publicação.
- `src/payload.mjs`: construção dos payloads, sem acesso ao navegador ou à rede.
- `src/cli.mjs`: argumentos, ambiente e interação com o terminal.
- `test/`: testes sem acesso ao Instagram; `scripts/`: verificações auxiliares.
- `examples/` e `assets/`: exemplos genéricos e imagem de teste.
- `.local/`: dados privados de execução; nunca versionar.

## Estilo de implementação

- Manter o padrão existente: dois espaços, aspas simples e ponto e vírgula em JavaScript.
- Usar nomes de código em inglês e documentação/mensagens destinadas ao usuário em português.
- Preferir módulos pequenos, funções puras para parsing/payloads e dependências já existentes.
- Não instalar plugins de stealth, desativar sandbox ou alterar verificações de segurança como solução padrão.
- Validar entradas antes de navegar ou publicar. Manter IDs como strings para preservar precisão.
- Confirmar o username e a rota ao extrair IDs; nunca confundir o perfil consultado com a conta autenticada.
- Resolver caminhos a partir do módulo ou arquivo de configuração apropriado, sem caminhos absolutos de uma máquina específica.
- Fechar o navegador em `finally`. Não abrir o mesmo perfil persistente em processos concorrentes.
- Preservar a compatibilidade da interface exportada e dos comandos existentes; documentar mudanças de contrato.

## Credenciais e dados públicos

- Credenciais vêm de variáveis de ambiente ou `.env`, nunca do código ou de argumentos da CLI.
- Não ler nem imprimir arquivos de credenciais para tarefas que não precisem deles.
- Não registrar senhas, códigos de verificação, tokens, valores de cookies, headers de autenticação ou respostas brutas sensíveis.
- Diagnósticos públicos usam estados, códigos e mensagens sanitizadas. Progresso e erros da CLI vão para `stderr`.
- Não versionar `.env`, `.local/`, perfis do Chrome, capturas ou arquivos de sessão.
- Exemplos e fixtures usam usuários e IDs fictícios. Não incluir contas de teste reais, links de posts/stories reais ou evidências privadas no material público.
- Os links institucionais e do mantenedor no template do README são informações públicas de autoria; não são credenciais nem contas operacionais de teste.

## Operações reais no Instagram

- Não executar publicações, convites ou outras escritas como consequência de testes automatizados.
- Testes reais de escrita exigem solicitação ou autorização já presente na conversa para a conta e o conteúdo correspondentes. Não pedir novamente uma autorização que já cubra a ação.
- Os comandos de feed/story mantêm a prévia local como padrão e exigem `--publish` para enviar.
- Confirmar a identidade da sessão e todos os IDs antes de escrever. Se faltar um ID, interromper a publicação.
- Não repetir automaticamente login, upload ou configuração após falha, timeout, HTTP 429 ou resposta ambígua.
- Se uma escrita ficar sem confirmação, verificar a publicação existente antes de considerar uma nova tentativa.
- Distinguir publicação criada, convite de collab enviado e colaboração aceita. Um convite pendente não comprova aceitação.
- Distinguir menção solicitada de menção confirmada e verificar o story específico, não apenas o primeiro story do perfil.
- Códigos de verificação podem ser pedidos pelo console. Não contornar CAPTCHA ou desafios de segurança.

## Validação das alterações

- Documentação e configuração editorial: revisar os comandos/links e executar `git diff --check`; não acessar o Instagram.
- Alterações de código: executar `npm test` e `npm run check`.
- Alterações em formulários ou integração com Puppeteer: executar também `npm run test:browser`, que usa HTML sintético.
- Adicionar testes para comportamento relevante e regressões; não criar testes que apenas repitam constantes de implementação.
- Não incluir testes de rede ou publicação em `npm test`.
- Não afirmar sucesso no Instagram com base apenas em mocks ou fixtures. Relatar separadamente testes locais, navegação real e operações efetivamente confirmadas.

## Documentação e Git

- Preservar o template do `README.md`: imagem inicial, badges, seções com emojis, divisórias, autoria, contato e licença.
- Atualizar documentação quando comandos, configuração ou comportamento mudarem.
- Não incrementar versão, criar tags/releases, fazer commits/pushes ou reescrever histórico sem solicitação correspondente.
- Quando houver release, manter `package.json`, `package-lock.json`, badge de versão e `CHANGELOG.md` consistentes.
- Manter credenciais e artefatos locais fora do commit. Não descartar alterações alheias.
- A limpeza de branches e tags anterior não autoriza novas limpezas futuras.
