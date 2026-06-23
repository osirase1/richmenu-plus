const crypto = require('crypto');

function getAppMode() {
  const mode = String(process.env.APP_MODE || 'client').trim().toLowerCase();
  return mode === 'owner' ? 'owner' : 'client';
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function getSecret() {
  return process.env.AUTH_SECRET || process.env.APP_PASSWORD || 'richmenu-plus-dev-secret';
}

function signPayload(payloadBase64) {
  return crypto.createHmac('sha256', getSecret()).update(payloadBase64).digest('base64url');
}

function createAuthToken() {
  const payload = {
    app: 'richmenu-plus',
    mode: 'client',
    authenticated: true,
    iat: Date.now()
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) return false;
  const expected = signPayload(payloadBase64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    return payload && payload.app === 'richmenu-plus' && payload.authenticated === true;
  } catch (_) {
    return false;
  }
}

function requireAppAuth(req) {
  const mode = getAppMode();
  if (mode === 'owner') return { ok: true, mode };

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    const error = new Error('Vercelの環境変数 APP_PASSWORD が未設定です。');
    error.statusCode = 500;
    throw error;
  }

  const authToken = String(req.headers['x-app-auth'] || '').trim();
  if (verifyAuthToken(authToken)) return { ok: true, mode };

  const actual = String(req.headers['x-app-password'] || '');
  if (actual === expected) return { ok: true, mode };

  const error = new Error('パスワードが違うか、未ログインです。');
  error.statusCode = 401;
  throw error;
}

function checkPasswordValue(password) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    const error = new Error('Vercelの環境変数 APP_PASSWORD が未設定です。');
    error.statusCode = 500;
    throw error;
  }
  if (String(password || '') !== expected) {
    const error = new Error('パスワードが違います。');
    error.statusCode = 401;
    throw error;
  }
  return true;
}

module.exports = {
  getAppMode,
  sendJson,
  createAuthToken,
  verifyAuthToken,
  requireAppAuth,
  checkPasswordValue,
};
