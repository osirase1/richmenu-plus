const { requireAppAuth, sendJson } = require('./_auth');
const { readJsonBody, getLineToken, assertLineApi } = require('./_line');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'POSTで送信してください。' });
  }

  try {
    requireAppAuth(req);
    const body = await readJsonBody(req);
    const token = getLineToken(req);
    const richMenuId = String(body.richMenuId || '').trim();
    if (!richMenuId) throw new Error('richMenuId がありません。先にLINEへ反映してください。');

    await assertLineApi(`/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`, 'POST', token);
    return sendJson(res, 200, { ok: true, richMenuId });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || 'デフォルト設定に失敗しました。' });
  }
};
