function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'POSTで送信してください。' });
  }
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return sendJson(res, 500, { ok: false, error: 'Vercelの環境変数 APP_PASSWORD が未設定です。' });
  }
  const actual = req.headers['x-app-password'] || '';
  if (actual !== expected) {
    return sendJson(res, 401, { ok: false, error: 'パスワードが違います。' });
  }
  return sendJson(res, 200, { ok: true });
};
