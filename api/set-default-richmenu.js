const { requireAppAuth, sendJson } = require('./_auth');

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('送信データが大きすぎます。'));
        req.destroy();
      }
    });
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

async function lineApi(path, method, body, token) {
  const headers = { Authorization: `Bearer ${token}` };
  const options = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`https://api.line.me${path}`, options);
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { message: text }; }
  if (!response.ok) throw new Error(data.message || text || `LINE API error: ${response.status}`);
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'POSTで送信してください。' });
  }
  try {
    requireAppAuth(req);
    const body = await readJsonBody(req);
    const token = getToken(req);
    const richMenuId = body.richMenuId;
    if (!richMenuId) throw new Error('richMenuId がありません。先にアップロードしてください。');
    await lineApi(`/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`, 'POST', undefined, token);
    return sendJson(res, 200, { ok: true, richMenuId });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || 'デフォルト設定に失敗しました。' });
  }
};
