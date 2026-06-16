function requireAppPassword(req) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    const error = new Error('Vercelの環境変数 APP_PASSWORD が未設定です。');
    error.statusCode = 500;
    throw error;
  }
  const actual = req.headers['x-app-password'] || '';
  if (actual !== expected) {
    const error = new Error('パスワードが違うか、未ログインです。');
    error.statusCode = 401;
    throw error;
  }
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function getToken(req) {
  const fromHeader = String(req.headers['x-line-token'] || '').trim();
  const token = fromHeader || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('チャネルアクセストークンがありません。画面のAPIタブに入力するか、Vercelの環境変数 LINE_CHANNEL_ACCESS_TOKEN に設定してください。');
  return token;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'POSTで送信してください。' });
  }

  try {
    requireAppPassword(req);
    const token = getToken(req);
    const response = await fetch('https://api.line.me/v2/bot/user/all/richmenu', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { message: text }; }

    if (response.ok) {
      return sendJson(res, 200, { ok: true, cleared: true });
    }
    if (response.status === 404) {
      return sendJson(res, 200, { ok: true, cleared: false, message: 'Messaging APIで設定されたデフォルトリッチメニューはありません。' });
    }
    const message = data.message || text || `LINE API error: ${response.status}`;
    return sendJson(res, response.status, { ok: false, error: message });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || 'デフォルト解除に失敗しました。' });
  }
};
