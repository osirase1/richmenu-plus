function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function checkPassword(req) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return { ok: false, status: 500, error: 'Vercelの環境変数 APP_PASSWORD が未設定です。' };
  const actual = req.headers['x-app-password'] || '';
  if (actual !== expected) return { ok: false, status: 401, error: 'パスワードが違います。' };
  return { ok: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'POSTで送信してください。' });
  }
  const auth = checkPassword(req);
  if (!auth.ok) return sendJson(res, auth.status, { ok: false, error: auth.error });
  return sendJson(res, 200, { ok: true, clientId: process.env.GOOGLE_CLIENT_ID || '' });
};
