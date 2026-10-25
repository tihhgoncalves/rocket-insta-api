export function normalizeUsername(value) {
  if (typeof value !== 'string') throw new Error('Informe um username.');
  const username = value.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(username)) throw new Error('Username inválido.');
  return username;
}

export function walkJson(documents, visit) {
  const stack = [...documents];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    visit(node);
    for (const value of Object.values(node)) if (value && typeof value === 'object') stack.push(value);
  }
}

export function extractProfile(documents, input) {
  const username = normalizeUsername(input);
  const ids = new Set();
  walkJson(documents, node => {
    const route = node.initialRouteInfo?.route;
    if (typeof route?.params?.username !== 'string' || typeof route.url !== 'string' ||
        route.params.username.toLowerCase() !== username || route.url.toLowerCase() !== `/${username}/`) return;
    for (const view of ['rootView', 'hostableView']) {
      const props = route[view]?.props;
      const id = props?.id;
      const logging = props?.page_logging;
      // Números JSON grandes já podem ter perdido precisão; não aceite esses IDs.
      if (typeof id === 'number' && !Number.isSafeInteger(id)) continue;
      if (!/^[1-9]\d*$/.test(String(id))) continue;
      if (logging?.name === 'profilePage' && String(logging.params?.profile_id) === String(id) &&
          logging.params?.page_id === `profilePage_${id}`) ids.add(String(id));
    }
  });
  if (ids.size > 1) throw new Error('O documento apresentou IDs conflitantes para o perfil.');
  return ids.size === 1 ? { id: [...ids][0], username } : null;
}

export function extractViewer(documents, sessionUserId) {
  const usernames = new Set();
  walkJson(documents, node => {
    if (String(node.id ?? node.pk ?? '') === String(sessionUserId) && typeof node.username === 'string') {
      try { usernames.add(normalizeUsername(node.username)); } catch { /* não é um perfil */ }
    }
  });
  if (usernames.size !== 1) return null;
  return { id: String(sessionUserId), username: [...usernames][0] };
}
