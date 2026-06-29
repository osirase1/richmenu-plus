const { requireAppAuth, sendJson } = require('./_auth');
const { getLineToken, requestLineApi } = require('./_line');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'POSTで送信してください。' });
  }

  try {
    requireAppAuth(req);
    const token = getLineToken(req);
    const result = await requestLineApi('/v2/bot/user/all/richmenu', 'DELETE', token);

    if (result.ok) return sendJson(res, 200, { ok: true, cleared: true });
    if (result.status === 404) {
      return sendJson(res, 200, { ok: true, cleared: false, message: 'Messaging APIで設定されたデフォルトリッチメニューはありません。' });
    }

    const message = (result.data && result.data.message) || result.text || `LINE API error: ${result.status}`;
    return sendJson(res, result.status, { ok: false, error: message });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || 'デフォルト解除に失敗しました。' });
  }
};
