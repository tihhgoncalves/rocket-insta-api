// Executada dentro da página: retorna apenas estado e seletores, nunca valores de inputs.
export function readLoginState({ waitForSubmit = false } = {}) {
  const visible = element => element && !element.closest('[hidden],[aria-hidden="true"]') &&
    element.getClientRects().length > 0 &&
    (typeof element.checkVisibility !== 'function' || element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
  const find = selectors => {
    for (const selector of selectors) {
      const element = [...document.querySelectorAll(selector)].find(visible);
      if (element) return element;
    }
    return null;
  };
  // Um seletor concreto evita escolher um input oculto ou outro botão com o mesmo texto.
  const selectorFor = element => {
    if (!element) return null;
    const parts = [];
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const position = node.parentElement ? [...node.parentElement.children].indexOf(node) + 1 : 1;
      parts.unshift(`${node.localName}:nth-child(${position})`);
    }
    return parts.join(' > ');
  };
  const usernameField = find(['input[name="username"]', 'input[name="email"]', 'input[autocomplete~="username"]']);
  const passwordField = find(['input[name="password"]', 'input[name="pass"]', 'input[type="password"]']);
  const codeField = find(['input[name="verificationCode"]', 'input[name="security_code"]',
    'input[name="approvals_code"]', 'input[autocomplete="one-time-code"]', 'input[name="code"]']);
  const activeField = codeField || passwordField;
  const form = activeField?.form;
  const normalize = value => value.replace(/\s+/g, ' ').trim().toLowerCase();
  const labels = codeField
    ? ['confirmar', 'confirm', 'continuar', 'continue', 'verificar', 'verify', 'avançar', 'next', 'submit']
    : ['entrar', 'log in', 'login', 'sign in', 'iniciar sessão', 'iniciar sesión', 'acceder', 'continuar', 'continue'];
  const labelFor = element => normalize(element.getAttribute('aria-label') ||
    (element.tagName === 'INPUT' ? element.value : element.innerText) || '');
  const eligible = element => visible(element) && (!waitForSubmit ||
    (!element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true' && !element.closest('[inert]')));
  let candidates = [];
  if (form) {
    candidates = [...form.querySelectorAll('button,input[type="submit"],[role="button"]')].filter(element =>
      eligible(element) && ((element.type === 'submit' && !labelFor(element)) || labels.includes(labelFor(element))));
  }
  if (!candidates.length) {
    candidates = [...document.querySelectorAll('button,[role="button"],input[type="submit"]')]
      .filter(element => eligible(element) && labels.includes(labelFor(element)));
  }
  // Nomes duplicados/ambíguos não justificam clicar no primeiro botão da página.
  const submit = candidates.length === 1 ? selectorFor(candidates[0]) : null;
  const text = (document.body?.innerText ?? '').toLowerCase();
  const path = location.pathname;
  if (document.querySelector('iframe[src*="captcha"], iframe[title*="reCAPTCHA"]') || /captcha/.test(path)) return { state: 'visual_challenge' };
  if (codeField && /incorrect security code|incorrect code|código incorreto|código inválido/.test(text)) return { state: 'invalid_code' };
  if (codeField) return waitForSubmit && !submit ? false : { state: 'code_required', code: selectorFor(codeField), submit };
  if (/\/(challenge|checkpoint)\//.test(path)) return { state: 'security_challenge' };
  if (/incorrect password|senha incorreta|password was incorrect|senha está incorreta/.test(text)) return { state: 'invalid_credentials' };
  if (/please wait a few minutes|aguarde alguns minutos|try again later|tente novamente mais tarde/.test(text)) return { state: 'rate_limited' };
  if (usernameField && passwordField) return waitForSubmit && !submit ? false : {
    state: 'credentials', username: selectorFor(usernameField), password: selectorFor(passwordField), submit,
  };
  return waitForSubmit ? false : { state: 'loading' };
}

export class AuthError extends Error {
  constructor(code, message) { super(message); this.name = 'AuthError'; this.code = code; }
}

export async function fillAndSubmit(page, fields, values) {
  try {
    for (const [field, value] of Object.entries(values)) {
      if (!fields[field]) throw new AuthError('FORM_CHANGED', 'Campo de autenticação não identificado; envio interrompido.');
      await page.locator(fields[field]).fill(value);
    }
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('FORM_INTERACTION_FAILED', 'Falha ao preencher o formulário de autenticação; envio interrompido.');
  }
  let handle;
  let ready;
  try {
    // A hidratação ou o preenchimento pode criar/habilitar o botão depois dos inputs.
    handle = await page.waitForFunction(readLoginState, { timeout: 15000 }, { waitForSubmit: true });
    ready = await handle.jsonValue();
  } catch {
    throw new AuthError('FORM_CHANGED', 'Botão de envio não identificado ou habilitado no prazo; nenhuma tentativa de envio foi feita.');
  } finally {
    if (handle) await handle.dispose();
  }
  const errors = {
    rate_limited: ['RATE_LIMITED', 'Instagram limitou o login; nenhuma tentativa de envio foi feita.'],
    invalid_credentials: ['INVALID_CREDENTIALS', 'Instagram recusou as credenciais.'],
    invalid_code: ['INVALID_VERIFICATION_CODE', 'Instagram recusou o código.'],
    visual_challenge: ['SECURITY_CHALLENGE', 'Instagram exige verificação de segurança.'],
    security_challenge: ['SECURITY_CHALLENGE', 'Instagram exige verificação de segurança.'],
  };
  if (errors[ready?.state]) throw new AuthError(...errors[ready.state]);
  if (!ready?.submit || ready.state !== fields.state) throw new AuthError('FORM_CHANGED', 'O formulário mudou antes do envio; operação interrompida.');
  try {
    // Apenas um clique. Nunca repetir em caso de timeout ou resposta ambígua.
    await page.locator(ready.submit).click();
  } catch {
    throw new AuthError('FORM_INTERACTION_FAILED', 'Falha ao enviar o formulário; confira a sessão antes de tentar novamente.');
  }
}
