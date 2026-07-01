const { requireAppAuth, sendJson } = require('./_auth');
const { readJsonBody, getLineToken } = require('./_line');

async function unlinkUser(userId, token) {
  const response = await fetch(`https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu`, {
    method: 'DELETE',
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
    const userIds = Array.isArray(body.userIds) ? body.userIds.map(x => String(x).trim()).filter(Boolean) : [];
    if (userIds.length === 0) throw new Error('ユーザーIDがありません。');

    const results = [];
    for (const userId of userIds) {
      try {
        await unlinkUser(userId, token);
        results.push({ userId, ok: true });
      } catch (error) {
        results.push({ userId, ok: false, error: error.message });
      }
    }

    const okCount = results.filter(r => r.ok).length;
    const ngCount = results.length - okCount;
    return sendJson(res, 200, { ok: true, okCount, ngCount, results });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || 'ユーザーリンク解除に失敗しました。' });
  }
};
