const { getAppMode, sendJson, createAuthToken, verifyAuthToken, checkPasswordValue } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'POSTで送信してください。' });
  }

  try {
    const mode = getAppMode();
    if (mode === 'owner') {
      return sendJson(res, 200, { ok: true, mode, passwordRequired: false });
    }

    const authToken = String(req.headers['x-app-auth'] || '').trim();
    if (verifyAuthToken(authToken)) {
      return sendJson(res, 200, { ok: true, mode, passwordRequired: true, authenticated: true });
    }

    const password = req.headers['x-app-password'] || '';
    checkPasswordValue(password);
    return sendJson(res, 200, {
      ok: true,
      mode,
      passwordRequired: true,
      authenticated: true,
      authToken: createAuthToken(),
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || '認証に失敗しました。' });
  }
};
