// Executada dentro da página: retorna apenas estado e seletores, nunca valores de inputs.
export function readLoginState() {
  const visible = element => element && element.getClientRects().length > 0;
  const pick = selectors => selectors.find(selector => [...document.querySelectorAll(selector)].some(visible)) ?? null;
  const username = pick(['input[name="username"]', 'input[name="email"]', 'input[autocomplete~="username"]']);
  const password = pick(['input[name="password"]', 'input[name="pass"]', 'input[type="password"]']);
  const code = pick(['input[name="verificationCode"]', 'input[name="security_code"]',
    'input[name="approvals_code"]', 'input[autocomplete="one-time-code"]', 'input[name="code"]']);
  let submit = pick(['form button[type="submit"]', 'form input[type="submit"]', 'button[type="submit"]', 'input[type="submit"]']);
  if (!submit) {
    const labels = ['Entrar', 'Log in', 'Confirmar', 'Confirm', 'Continuar', 'Continue', 'Verificar', 'Verify', 'Avançar', 'Next'];
    const button = [...document.querySelectorAll('button,[role="button"]')].find(element =>
      visible(element) && labels.includes((element.getAttribute('aria-label') || element.innerText || '').trim()));
    if (button) {
      const label = (button.getAttribute('aria-label') || button.innerText).trim();
      submit = `::-p-aria(${label}[role="button"])`;
    }
  }
  const text = (document.body?.innerText ?? '').toLowerCase();
  const path = location.pathname;
  if (document.querySelector('iframe[src*="captcha"], iframe[title*="reCAPTCHA"]') || /captcha/.test(path)) return { state: 'visual_challenge' };
  if (code && /incorrect security code|incorrect code|código incorreto|código inválido/.test(text)) return { state: 'invalid_code' };
  if (code) return { state: 'code_required', code, submit };
  if (/\/(challenge|checkpoint)\//.test(path)) return { state: 'security_challenge' };
  if (/incorrect password|senha incorreta|password was incorrect|senha está incorreta/.test(text)) return { state: 'invalid_credentials' };
  if (/please wait a few minutes|aguarde alguns minutos|try again later|tente novamente mais tarde/.test(text)) return { state: 'rate_limited' };
  if (username && password) return { state: 'credentials', username, password, submit };
  return { state: 'loading' };
}

export class AuthError extends Error {
  constructor(code, message) { super(message); this.name = 'AuthError'; this.code = code; }
}

export async function fillAndSubmit(page, fields, values) {
  if (!fields.submit) throw new AuthError('FORM_CHANGED', 'Formulário de login mudou; envio interrompido.');
  try {
    for (const [field, value] of Object.entries(values)) {
      await page.locator(fields[field]).fill(value);
    }
    await page.locator(fields.submit).click();
  } catch {
    // Não propague argumentos ou detalhes internos de uma operação com credenciais.
    throw new AuthError('FORM_INTERACTION_FAILED', 'Falha ao preencher ou enviar o formulário de autenticação. Confira a sessão antes de tentar novamente.');
  }
}
