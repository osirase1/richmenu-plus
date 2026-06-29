const { requireAppAuth, sendJson } = require('./_auth');
const { readJsonBody, getLineToken } = require('./_line');

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
    requireAppAuth(req);
    const body = await readJsonBody(req);
    const token = getLineToken(req);
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
