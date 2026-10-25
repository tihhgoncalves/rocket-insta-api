// Retorna somente categorias conhecidas. Mensagens e corpos remotos nunca saem daqui.
export function classifyAuthResponse(httpStatus, data, source = 'login') {
  const message = [data?.message, data?.error_type, ...(Array.isArray(data?.errors) ? data.errors.map(e => e?.message) : [])]
    .filter(value => typeof value === 'string').join(' ').toLowerCase();
  let outcome = 'unclassified';
  if (httpStatus === 429 || /please wait|try again later|rate.limit|aguarde alguns minutos/.test(message)) outcome = 'rate_limited';
  else if (data?.two_factor_required === true || /two.factor.required/.test(message)) outcome = 'code_required';
  else if (data?.checkpoint_url || data?.challenge || /challenge|checkpoint|captcha/.test(message)) outcome = 'security_challenge';
  else if (/incorrect.password|invalid.password|bad.password|senha incorreta/.test(message)) outcome = 'invalid_credentials';
  else if (data?.authenticated === true) outcome = 'authenticated_response';
  else if (data?.authenticated === false || data?.status === 'fail' || httpStatus >= 400) outcome = 'login_rejected';
  return { source: source === 'graphql' ? 'graphql' : 'login', httpStatus, outcome };
}

// Executada no navegador. Não retorna texto, URLs completas, nomes de inputs ou valores.
export function readAuthPageSummary() {
  const visible = element => element.getClientRects().length > 0 && !element.closest('[hidden],[aria-hidden="true"]');
  const text = (document.body?.innerText ?? '').toLowerCase();
  const path = location.pathname;
  const route = /two_factor|two_step|verification/.test(path) ? 'verification' :
    /challenge|checkpoint|captcha/.test(path) ? 'security' : /login/.test(path) ? 'login' : path === '/' ? 'home' : 'other';
  return {
    route,
    visibleInputs: [...document.querySelectorAll('input')].filter(visible).length,
    passwordFieldPresent: [...document.querySelectorAll('input[type="password"]')].some(visible),
    alertPresent: [...document.querySelectorAll('[role="alert"],[aria-live="assertive"]')].some(visible),
    codePromptPresent: /verification code|security code|código de (?:segurança|verificação)|authentication code/.test(text),
    approvalPromptPresent: /check (?:your notifications|another device)|approve.*(?:login|request)|aprov[ae].*(?:acesso|solicitação)|outro dispositivo/.test(text),
    postLoginPromptPresent: /save your login|salvar.*(?:login|acesso)|turn on notifications|ativar notificações/.test(text),
    captchaFramePresent: Boolean(document.querySelector('iframe[src*="captcha"],iframe[title*="reCAPTCHA"]')),
  };
}

export function summarizeLogin({ page, state, sessionCookiePresent, userIdCookiePresent, responses = [], frameSecurityPresent = false }) {
  const knownStates = ['credentials', 'loading', 'code_required', 'invalid_code', 'invalid_credentials', 'rate_limited',
    'visual_challenge', 'security_challenge', 'approval_required', 'verification_pending', 'post_login_prompt'];
  const safeResponses = responses.slice(-5).map(response => ({
    source: response.source === 'graphql' ? 'graphql' : 'login',
    httpStatus: Number.isInteger(response.httpStatus) ? response.httpStatus : 0,
    outcome: ['unclassified', 'rate_limited', 'code_required', 'security_challenge', 'invalid_credentials',
      'authenticated_response', 'login_rejected'].includes(response.outcome) ? response.outcome : 'unclassified',
  }));
  const safePage = {
    route: ['verification', 'security', 'login', 'home', 'other'].includes(page?.route) ? page.route : 'unknown',
    visibleInputs: Number.isInteger(page?.visibleInputs) ? Math.max(0, page.visibleInputs) : 0,
  };
  for (const key of ['passwordFieldPresent', 'alertPresent', 'codePromptPresent', 'approvalPromptPresent', 'postLoginPromptPresent', 'captchaFramePresent']) {
    safePage[key] = page?.[key] === true;
  }
  let classification = 'unclassified';
  const outcomes = new Set(safeResponses.map(response => response.outcome));
  if (state === 'rate_limited' || outcomes.has('rate_limited')) classification = 'rate_limited';
  else if (frameSecurityPresent || safePage.captchaFramePresent || safePage.route === 'security' || outcomes.has('security_challenge')) classification = 'security_challenge';
  else if (safePage.approvalPromptPresent || state === 'approval_required') classification = 'approval_required';
  else if (safePage.codePromptPresent || safePage.route === 'verification' || outcomes.has('code_required') || state === 'code_required') classification = 'verification_pending';
  else if (outcomes.has('invalid_credentials') || state === 'invalid_credentials') classification = 'invalid_credentials';
  else if (outcomes.has('login_rejected')) classification = 'login_rejected';
  else if (sessionCookiePresent && userIdCookiePresent) classification = 'session_unverified';
  else if (safePage.alertPresent) classification = 'feedback_present';
  else if (safePage.postLoginPromptPresent) classification = 'post_login_prompt';
  else if (state === 'credentials') classification = 'login_form_still_present';
  return { classification, state: knownStates.includes(state) ? state : 'unknown', page: safePage,
    sessionCookiePresent: sessionCookiePresent === true, userIdCookiePresent: userIdCookiePresent === true,
    frameSecurityPresent: frameSecurityPresent === true, responses: safeResponses };
}
