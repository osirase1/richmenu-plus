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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (_) { reject(new Error('JSONの読み込みに失敗しました。')); }
    });
    req.on('error', reject);
  });
}

function getToken(req) {
  const fromHeader = String(req.headers['x-line-token'] || '').trim();
  const token = fromHeader || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('チャネルアクセストークンがありません。画面のAPIタブに入力するか、Vercelの環境変数 LINE_CHANNEL_ACCESS_TOKEN に設定してください。');
  return token;
}

async function linkUser(userId, richMenuId, token) {
  const response = await fetch(`https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu/${encodeURIComponent(richMenuId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `LINE API error: ${response.status}`);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POSTで送信してください。' });

  try {
    requireAppPassword(req);
    const body = await readJsonBody(req);
    const token = getToken(req);
    const richMenuId = String(body.richMenuId || '').trim();
    const userIds = Array.isArray(body.userIds) ? body.userIds.map(x => String(x).trim()).filter(Boolean) : [];

    if (!richMenuId) throw new Error('richMenuIdがありません。');
    if (userIds.length === 0) throw new Error('ユーザーIDがありません。');

    const results = [];
    for (const userId of userIds) {
      try {
        await linkUser(userId, richMenuId, token);
        results.push({ userId, ok: true });
      } catch (error) {
        results.push({ userId, ok: false, error: error.message });
      }
    }

    const okCount = results.filter(r => r.ok).length;
    const ngCount = results.length - okCount;
    return sendJson(res, 200, { ok: true, okCount, ngCount, results });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || 'ユーザーリンクに失敗しました。' });
  }
};
