import puppeteer from 'puppeteer';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { extractProfile, extractViewer, normalizeUsername } from './profile.mjs';
import { buildPublication } from './payload.mjs';
import { readLoginState, fillAndSubmit, AuthError } from './auth.mjs';
import { classifyAuthResponse, readAuthPageSummary, summarizeLogin } from './login-diagnostics.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ORIGIN = 'https://www.instagram.com';
const APP_ID = '936619743392459';

export class InstagramBrowser {
  constructor({ headless = true, profileDir = resolve(ROOT, '.local/profile') } = {}) {
    this.options = { headless, profileDir };
    this.events = [];
    this.cache = new Map();
    this.lastLoginDiagnostics = null;
  }
  async open() {
    await mkdir(this.options.profileDir, { recursive: true, mode: 0o700 });
    this.browser = await puppeteer.launch({
      headless: this.options.headless, userDataDir: this.options.profileDir,
      defaultViewport: { width: 1280, height: 900 },
    });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(20000);
    this.page.setDefaultNavigationTimeout(45000);
    this.page.on('response', response => {
      const url = new URL(response.url());
      if (url.hostname.endsWith('.instagram.com') &&
          (/^\/api\//.test(url.pathname) || /^\/graphql/.test(url.pathname) || /^\/rupload/.test(url.pathname))) {
        this.events.push({ method: response.request().method(), path: url.pathname, status: response.status() });
        if (this.events.length > 100) this.events.shift();
      }
    });
    return this;
  }
  async documents() {
    return this.page.evaluate(() => [...document.querySelectorAll('script[type="application/json"]')]
      .flatMap(script => { try { return [JSON.parse(script.textContent)]; } catch { return []; } }));
  }
  async navigate(path, { allowChallenge = false } = {}) {
    const response = await this.page.goto(`${ORIGIN}${path}`, { waitUntil: 'domcontentloaded' });
    if (response?.status() === 429) throw new Error('HTTP 429: consulta limitada. Nenhuma repetição foi feita.');
    if (response && response.status() >= 400) throw new Error(`Página indisponível: HTTP ${response.status()}.`);
    const current = new URL(this.page.url());
    if (!allowChallenge && /\/(challenge|checkpoint)\//.test(current.pathname)) throw new AuthError('SECURITY_CHALLENGE', 'Verificação de segurança necessária. Execute login pelo console.');
    return response;
  }
  async viewer() {
    const cookies = await this.browser.cookies();
    const id = cookies.find(c => c.name === 'ds_user_id' && /(^|\.)instagram\.com$/.test(c.domain))?.value;
    if (!id || !cookies.some(c => c.name === 'sessionid' && /(^|\.)instagram\.com$/.test(c.domain))) return null;
    return extractViewer(await this.documents(), id);
  }
  getLastLoginDiagnostics() { return this.lastLoginDiagnostics; }

  async captureLoginDiagnostics(state, responses) {
    const page = await this.page.evaluate(readAuthPageSummary).catch(() => ({}));
    const cookies = await this.browser.cookies().catch(() => []);
    const hasCookie = name => cookies.some(cookie => cookie.name === name && /(^|\.)instagram\.com$/.test(cookie.domain));
    const frameSecurityPresent = (this.page.frames?.() ?? []).some(frame => {
      try { return /challenge|checkpoint|captcha/.test(new URL(frame.url()).pathname); } catch { return false; }
    });
    const summary = summarizeLogin({ page, state, responses, frameSecurityPresent,
      sessionCookiePresent: hasCookie('sessionid'), userIdCookiePresent: hasCookie('ds_user_id') });
    const artifacts = {};
    // Dentro do perfil gravável: funciona quando o pacote está instalado como somente leitura no VPS.
    const directory = resolve(this.options.profileDir, 'rocket-diagnostics');
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const base = resolve(directory, `${Date.now()}-login`);
      artifacts.json = `${base}.json`;
      await writeFile(artifacts.json, JSON.stringify(summary, null, 2), { mode: 0o600 });
      let diagnosticPage;
      try {
        // Nunca fotografar a página de login: apenas um painel local com os dados permitidos.
        diagnosticPage = await this.browser.newPage();
        await diagnosticPage.setJavaScriptEnabled(false);
        const escaped = JSON.stringify(summary, null, 2).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
        await diagnosticPage.setContent(`<html><head><meta charset="utf-8"></head><body style="font:16px monospace;padding:24px"><h1>Diagnóstico sanitizado do login</h1><p>Painel local. Não é uma captura da página original.</p><pre>${escaped}</pre></body></html>`);
        artifacts.screenshot = `${base}.png`;
        await diagnosticPage.screenshot({ path: artifacts.screenshot, fullPage: true });
        await chmod(artifacts.screenshot, 0o600);
      } catch { delete artifacts.screenshot; }
      finally { if (diagnosticPage) await diagnosticPage.close().catch(() => {}); }
    } catch { delete artifacts.json; }
    return { ...summary, artifacts };
  }

  async login(options = {}) {
    this.lastLoginDiagnostics = null;
    this.lastLoginState = 'unknown';
    const responses = [];
    const observe = async response => {
      try {
        const url = new URL(response.url());
        const request = response.request();
        if (!/(^|\.)instagram\.com$/.test(url.hostname) || request.method() !== 'POST') return;
        let source;
        if (/\/accounts\/login\/ajax\/?$/.test(url.pathname) || /\/accounts\/login\/?$/.test(url.pathname)) source = 'login';
        else if (/graphql/.test(url.pathname)) {
          const body = request.postData() ?? '';
          if (body.length > 1024 * 1024) return;
          const operation = new URLSearchParams(body).get('fb_api_req_friendly_name');
          if (!operation || !/login|authenticate/i.test(operation)) return;
          source = 'graphql';
        }
        if (!source) return;
        let data = null;
        try { data = await response.json(); } catch { /* não guardar corpo de resposta */ }
        const classified = classifyAuthResponse(response.status(), data, source);
        responses.push(classified);
        if (responses.length > 10) responses.shift();
        options.onEvent?.({ event: 'login_response', ...classified });
      } catch { /* observação nunca interrompe a autenticação */ }
    };
    this.page.on?.('response', observe);
    try { return await this.runLogin({ ...options, responses }); }
    catch (error) {
      if (['LOGIN_TIMEOUT', 'SECURITY_CHALLENGE', 'CODE_REQUIRED', 'APPROVAL_REQUIRED', 'RATE_LIMITED', 'LOGIN_REJECTED'].includes(error.code)) {
        try {
          this.lastLoginDiagnostics = await this.captureLoginDiagnostics(this.lastLoginState, responses);
          error.diagnostics = this.lastLoginDiagnostics;
          if (error.code === 'LOGIN_TIMEOUT') error.message += ` Diagnóstico: ${this.lastLoginDiagnostics.classification}.`;
          options.onEvent?.({ event: 'login_diagnostic', diagnostic: this.lastLoginDiagnostics });
        } catch { /* preservar o erro original; nunca capturar screenshot bruto como fallback */ }
      }
      throw error;
    } finally { this.page.off?.('response', observe); }
  }

  async runLogin({ account, username = account, password, requestCode,
    onEvent = () => {}, manual = false, timeout = 120000, responses = [] } = {}) {
    account = normalizeUsername(account);
    if (normalizeUsername(username) !== account) throw new AuthError('ACCOUNT_MISMATCH', 'Credenciais e conta esperada são diferentes.');
    if (manual && this.options.headless) throw new AuthError('MANUAL_REQUIRES_WINDOW', 'Login manual só é permitido com --headed.');
    await this.navigate('/', { allowChallenge: true });
    const deadline = Date.now() + timeout;
    let submitted = false;
    let codeSubmitted = false;
    this.lastLoginState = 'loading';
    while (Date.now() < deadline) {
      const viewer = await this.viewer().catch(() => null);
      if (viewer) {
        if (viewer.username !== account) throw new AuthError('ACCOUNT_MISMATCH', `Sessão pertence a @${viewer.username}; esperado @${account}.`);
        onEvent({ event: 'authenticated', reusedSession: !submitted });
        return viewer;
      }
      if (!this.browser.connected) throw new Error('Navegador foi fechado antes de concluir o login.');
      const state = await this.page.evaluate(readLoginState).catch(() => ({ state: 'loading' }));
      if (state.state !== this.lastLoginState) {
        this.lastLoginState = state.state;
        onEvent({ event: 'login_state', state: state.state });
      }
      if (manual) { await delay(1000); continue; }
      const outcomes = new Set(responses.map(response => response.outcome));
      if (outcomes.has('rate_limited')) throw new AuthError('RATE_LIMITED', 'Instagram limitou a resposta do login; nenhum reenvio foi feito.');
      if (outcomes.has('security_challenge')) throw new AuthError('SECURITY_CHALLENGE', 'A resposta de login indica verificação de segurança.');
      if (outcomes.has('invalid_credentials')) throw new AuthError('INVALID_CREDENTIALS', 'A resposta de login recusou as credenciais.');
      if (outcomes.has('login_rejected')) throw new AuthError('LOGIN_REJECTED', 'Instagram recusou o login; detalhes remotos foram omitidos.');
      if (state.state === 'approval_required') throw new AuthError('APPROVAL_REQUIRED', 'Instagram pede aprovação em outro dispositivo. Nenhum reenvio foi feito.');
      if (state.state === 'rate_limited') throw new AuthError('RATE_LIMITED', 'Instagram limitou o login; nenhuma repetição foi feita.');
      if (state.state === 'invalid_credentials') throw new AuthError('INVALID_CREDENTIALS', 'Instagram recusou as credenciais.');
      if (state.state === 'invalid_code') throw new AuthError('INVALID_VERIFICATION_CODE', 'Instagram recusou o código; nenhuma nova tentativa foi feita.');
      if (state.state === 'visual_challenge' || state.state === 'security_challenge') {
        throw new AuthError('SECURITY_CHALLENGE', 'Instagram exige interação de segurança que não pode ser concluída automaticamente pelo console.');
      }
      if (state.state === 'credentials' && !submitted) {
        if (typeof password !== 'string' || !password) throw new AuthError('CREDENTIALS_REQUIRED', 'Configure IG_USERNAME e IG_PASSWORD no ambiente ou no arquivo .env da raiz.');
        await fillAndSubmit(this.page, state, { username, password });
        submitted = true;
        password = undefined;
        onEvent({ event: 'credentials_submitted' });
      }
      if (state.state === 'code_required' && !codeSubmitted) {
        if (!requestCode) throw new AuthError('CODE_REQUIRED', 'Instagram solicitou código de verificação. Execute login em um terminal interativo.');
        onEvent({ event: 'verification_code_required' });
        const code = await requestCode({ signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())) });
        if (!/^\d{6,8}$/.test(code?.trim() ?? '')) throw new AuthError('INVALID_CODE_FORMAT', 'Informe um código de 6 a 8 dígitos.');
        await fillAndSubmit(this.page, state, { code: code.trim() });
        codeSubmitted = true;
        onEvent({ event: 'verification_code_submitted' });
      }
      await delay(1000);
    }
    throw new AuthError('LOGIN_TIMEOUT', 'Login não confirmado no prazo. Não houve repetição das credenciais ou do código.');
  }
  async assertAccount(account) {
    await this.navigate('/');
    const viewer = await this.viewer();
    if (!viewer || viewer.username !== normalizeUsername(account)) {
      throw new Error(`Execute login como @${normalizeUsername(account)} antes de publicar.`);
    }
    return viewer;
  }
  async lookup(input) {
    const username = normalizeUsername(input);
    if (this.cache.has(username)) return this.cache.get(username);
    await this.navigate(`/${username}/`);
    const profile = extractProfile(await this.documents(), username);
    if (!profile) throw new Error(`A página de @${username} não forneceu um ID verificável. Nenhum fallback foi executado.`);
    this.cache.set(username, profile);
    return profile;
  }
  async inspect() {
    return {
      path: new URL(this.page.url()).pathname,
      cookies: (await this.browser.cookies()).filter(c => /(^|\.)instagram\.com$/.test(c.domain))
        .map(({ name, domain, httpOnly, secure, sameSite }) => ({ name, domain, httpOnly, secure, sameSite })),
      requests: [...this.events],
    };
  }
  async verifyFeed(url, recipe) {
    const target = new URL(url);
    if (target.origin !== ORIGIN || !/^\/p\/[A-Za-z0-9_-]+\/$/.test(target.pathname)) throw new Error('Link de post inválido.');
    await this.navigate(target.pathname);
    await this.page.waitForFunction(({ account, caption }) =>
      [...document.querySelectorAll('a')].some(a => a.getAttribute('href') === `/${account}/`) &&
      document.body.innerText.includes(caption), { timeout: 30000 }, recipe);
    const tagged = [...new Set([...recipe.mentions, ...recipe.collaborators])];
    if (tagged.length) {
      await this.page.evaluate(() => document.querySelector('svg[aria-label="Tags"]')?.closest('button,[role="button"]')?.click());
      await this.page.waitForFunction(usernames => usernames.every(username =>
        [...document.querySelectorAll('a')].some(a => a.getAttribute('href') === `/${username}/` &&
          a.textContent.trim() === username && a.getClientRects().length > 0)), { timeout: 10000 }, tagged);
    }
    let collaborationPending = null;
    if (recipe.collaborators.length) {
      collaborationPending = await this.page.waitForFunction(() =>
        /recebeu um convite para se tornar colaborador|invited to (?:be a collaborator|collaborate)/i.test(document.body.innerText),
      { timeout: 10000 }).then(() => true).catch(() => false);
    }
    return { authorConfirmed: true, captionConfirmed: true, photoTagsConfirmed: tagged, collaborationPending };
  }
  async verifyStory(url, recipe) {
    const target = new URL(url);
    if (target.origin !== ORIGIN || !new RegExp(`^/stories/${recipe.account.replaceAll('.', '\\.')}/[0-9]+/$`).test(target.pathname)) {
      throw new Error('É necessário o link de um story específico para verificar a menção.');
    }
    await this.navigate(target.pathname);
    await this.page.waitForFunction(() => document.querySelector('svg[aria-label="Pausar"],svg[aria-label="Pause"]'));
    await this.page.evaluate(() => document.querySelector('svg[aria-label="Pausar"],svg[aria-label="Pause"]')?.closest('button,[role="button"]')?.click());
    const mentionsConfirmed = [];
    for (const [index, username] of recipe.mentions.entries()) {
      const clicked = await this.page.evaluate(index => {
        const button = document.querySelectorAll('[role="button"][aria-haspopup="dialog"]')[index];
        if (!button) return false;
        button.click();
        return true;
      }, index);
      if (!clicked) throw new Error('Área de menção não encontrada no story.');
      await this.page.waitForFunction(username => [...document.querySelectorAll('a')]
        .some(a => a.getAttribute('href') === `/${username}/` && a.getClientRects().length > 0), { timeout: 10000 }, username);
      mentionsConfirmed.push(username);
      if (index < recipe.mentions.length - 1) {
        await this.page.evaluate(() => document.querySelector('[role="button"][aria-haspopup="dialog"][aria-expanded="true"]')?.click());
      }
    }
    return { storyId: target.pathname.split('/')[3], mentionsConfirmed, mobileEmulation: false };
  }
  async screenshot(label) {
    const directory = resolve(ROOT, '.local/screenshots');
    await mkdir(directory, { recursive: true });
    const path = resolve(directory, `${Date.now()}-${label.replace(/[^a-z0-9-]/gi, '')}.png`);
    await this.page.screenshot({ path });
    return path;
  }
  async request(path, { form, bytes, uploadHeaders } = {}) {
    if (!/^\/(?:api\/v1\/media\/(?:configure|configure_to_story)\/|rupload_igphoto\/fb_uploader_\d+)$/.test(path)) {
      throw new Error('Caminho de publicação inválido.');
    }
    const cookies = await this.browser.cookies();
    const csrf = cookies.find(c => c.name === 'csrftoken' && /(^|\.)instagram\.com$/.test(c.domain))?.value;
    if (!csrf) throw new Error('Sessão sem CSRF. Execute login.');
    const result = await this.page.evaluate(async ({ path, form, base64, csrf, appId, uploadHeaders }) => {
      const headers = { 'x-csrftoken': csrf, 'x-ig-app-id': appId, 'x-requested-with': 'XMLHttpRequest', ...uploadHeaders };
      let body;
      if (base64 !== null) {
        const decoded = atob(base64);
        body = Uint8Array.from(decoded, char => char.charCodeAt(0));
      } else {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        body = new URLSearchParams(form).toString();
      }
      const response = await fetch(path, { method: 'POST', credentials: 'include', headers, body });
      let json = null;
      try { json = await response.json(); } catch { /* não retornar HTML ou dados brutos */ }
      const media = json?.media;
      const safeId = value => typeof value === 'string' ? value : (Number.isSafeInteger(value) ? String(value) : null);
      return {
        httpStatus: response.status, ok: response.ok && json?.status === 'ok',
        challenge: /challenge|checkpoint/.test(String(json?.message ?? '')),
        id: safeId(media?.id) ?? safeId(media?.pk),
        code: typeof media?.code === 'string' ? media.code : null,
        hasMedia: Boolean(media),
        mentions: (media?.reel_mentions ?? []).map(m => String(m.user?.pk ?? m.user_id ?? '')),
        collaborators: (media?.invited_coauthor_producers ?? []).map(u => String(u.pk ?? u.id ?? '')),
      };
    }, { path, form, base64: bytes ? bytes.toString('base64') : null, csrf, appId: APP_ID, uploadHeaders });
    if (!result.ok) {
      throw new Error(result.challenge ? 'Instagram exige verificação manual.' :
        `Instagram não confirmou a operação (HTTP ${result.httpStatus}). Não repita sem conferir o perfil.`);
    }
    return result;
  }
  async publish(recipe) {
    await this.assertAccount(recipe.account);
    const users = new Map();
    for (const username of new Set([...recipe.mentions, ...recipe.collaborators])) users.set(username, await this.lookup(username));
    // Volta ao contexto da conta antes de qualquer escrita.
    await this.assertAccount(recipe.account);
    const bytes = await readFile(recipe.image);
    const base64 = bytes.toString('base64');
    const dimensions = await this.page.evaluate(async base64 => {
      const image = new Image();
      image.src = `data:image/jpeg;base64,${base64}`;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, base64);
    const uploadId = String(Date.now());
    const name = `fb_uploader_${uploadId}`;
    const publication = buildPublication(recipe, users, uploadId);
    await this.request(`/rupload_igphoto/${name}`, { bytes, uploadHeaders: {
      'Content-Type': 'image/jpeg', 'x-entity-type': 'image/jpeg',
      'x-entity-name': name, 'x-entity-length': String(bytes.length), offset: '0',
      'x-instagram-rupload-params': JSON.stringify({ media_type: 1, upload_id: uploadId,
        upload_media_height: dimensions.height, upload_media_width: dimensions.width }),
    } });
    const result = await this.request(publication.path, { form: publication.form });
    if (!result.hasMedia) throw new Error('Resposta sem mídia verificável. Confira o perfil antes de repetir.');
    const storyId = result.id?.split('_')[0];
    return { ...result, url: recipe.kind === 'feed' && result.code ? `${ORIGIN}/p/${result.code}/` :
      `${ORIGIN}/stories/${recipe.account}/${storyId && /^\d+$/.test(storyId) ? `${storyId}/` : ''}`,
      requestedMentions: recipe.mentions, requestedCollaborators: recipe.collaborators };
  }
  async close() { if (this.browser) await this.browser.close(); }
}
