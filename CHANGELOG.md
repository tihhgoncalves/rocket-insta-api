# Changelog

## Alterações após 0.0.1

- Classifica a etapa posterior ao envio do login por estados do formulário e respostas de autenticação sanitizadas.
- Detecta variantes de campo de código, aprovação em outro dispositivo e telas de confirmação após login.
- Em timeout, expõe `error.diagnostics`, `getLastLoginDiagnostics()` e o evento `login_diagnostic`, sem reenviar credenciais.
- Gera relatório JSON e painel PNG local sanitizado no perfil gravável; nunca captura a página original de autenticação.
- Preserva o sandbox, omite mensagens/corpos remotos e não confunde cookies presentes com identidade confirmada.

- O login aguarda até 15 segundos por um botão de envio reconhecido e habilitado após preencher os campos.
- Reconhece botões nativos, inclusive sem `type`, e controles com `role="button"`, com variações de idioma e capitalização.
- Restringe a escolha ao formulário quando possível, ignora controles ocultos e rejeita botões ambíguos.
- Reavalia os seletores após o preenchimento, sem repetir o envio em caso de falha ou resultado incerto.
- Adiciona regressões sem rede e quatro variantes sintéticas de formulário no Chrome headless.
- Validação local; o login de produção no Ubuntu deve ser confirmado separadamente. Nenhuma publicação ou envio de credenciais foi realizado para investigar esta correção.

## 0.0.1 — beta — 2026-10-25

Início da implementação Node.js do Rocket Insta API.

- Projeto Node/Puppeteer promovido à raiz, com dependências e lockfile próprios.
- Removidos da árvore ativa os fontes, testes, manifesto e lockfile da implementação anterior.
- Login automático headless, sessão persistente e suporte a código de verificação pelo console.
- Consulta de IDs pelo documento do perfil, com validação de username e rota.
- Publicação de foto no feed com marcações e convite de colaboração.
- Publicação de story com menções interativas.
- Verificação posterior de posts e stories sem repetir a publicação.
- CLI, exportações de biblioteca, exemplos, inspeção sanitizada e testes locais.
- Login automático, busca de IDs, feed, convite de colaboração e story com menção validados localmente em modo headless.

Ainda pendentes: validação em VPS Linux, 2FA real e aceitação de convite de
colaboração pelo destinatário. Não há servidor HTTP, agendador ou fila implementados.
