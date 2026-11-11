export function localOrigin(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('QA requires an HTTP loopback origin');
  return url.origin;
}

export function qaBindings(partyOrigin, secret) {
  if (!secret || secret.length < 32) throw Error('QA requires a fresh local secret');
  return {
    CALLBACK_ENV: 'development', PARTY_WORKER_URL: localOrigin(partyOrigin), PARTY_SECRET: secret,
    OPENAI_API_KEY: '', OPENAI_IMAGE_API_KEY: '', OPENAI_IMAGES_ENABLED: 'false',
    CLOUDFLARE_AI_API_TOKEN: '', CLOUDFLARE_ACCOUNT_ID: '', OPENAI_IMAGES_CREDIT_WINDOW: '',
    OPENAI_IMAGES_STOP_AT: '2000-01-01T00:00:00Z', ARCADE_WORKER_URL: '',
    ARCADE_TICKET_SECRET: '', ARCADE_CONTROL_SECRET: '', ARCADE_CALLBACK_SECRET: '',
  };
}

export function qaProcessEnv(source, bindings) {
  const env = Object.fromEntries(Object.entries(source).filter(([key]) => !/^(?:OPENAI_|CLOUDFLARE_|ARCADE_|PARTY_|CALLBACK_QA_|VITE_)/i.test(key)));
  return { ...env, ...bindings, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false' };
}
