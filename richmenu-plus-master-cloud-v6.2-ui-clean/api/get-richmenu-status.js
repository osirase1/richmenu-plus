const { requireAppAuth, sendJson } = require('./_auth');
const { readJsonBody, getLineToken, requestLineApi, normalizeLineError } = require('./_line');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'POSTで送信してください。' });
  }

  try {
    requireAppAuth(req);
    const body = await readJsonBody(req);
    const token = getLineToken(req);
    const userId = String(body.userId || '').trim();

    const defaultResult = await requestLineApi('/v2/bot/user/all/richmenu', 'GET', token);
    let defaultRichMenuId = null;
    let defaultStatus = 'not_set';
    let defaultMessage = 'Messaging APIで設定されたデフォルトリッチメニューはありません。';

    if (defaultResult.ok) {
      defaultRichMenuId = defaultResult.data.richMenuId || null;
      defaultStatus = defaultRichMenuId ? 'set' : 'not_set';
      defaultMessage = defaultRichMenuId ? 'Messaging APIのデフォルトリッチメニューが設定されています。' : defaultMessage;
    } else if (defaultResult.status === 404) {
      defaultStatus = 'not_set';
    } else if (defaultResult.status === 403) {
      defaultStatus = 'blocked';
      defaultMessage = 'LINE Official Account Managerなど、別チャネル側でデフォルト設定されている可能性があります。';
    } else {
      defaultStatus = 'error';
      defaultMessage = normalizeLineError(defaultResult, 'デフォルトリッチメニューの確認に失敗しました。');
    }

    let userRichMenuId = null;
    let userStatus = 'skipped';
    let userMessage = userId ? '' : 'ユーザーIDが未入力のため、個別リンク確認はスキップしました。';

    if (userId) {
      const userResult = await requestLineApi(`/v2/bot/user/${encodeURIComponent(userId)}/richmenu`, 'GET', token);
      if (userResult.ok) {
        userRichMenuId = userResult.data.richMenuId || null;
        userStatus = userRichMenuId ? 'linked' : 'not_linked';
        userMessage = userRichMenuId ? 'このユーザーには個別リッチメニューがリンクされています。' : 'このユーザーに個別リッチメニューはリンクされていません。';
      } else if (userResult.status === 404) {
        userStatus = 'not_linked';
        userMessage = 'このユーザーに個別リッチメニューはリンクされていません。';
      } else {
        userStatus = 'error';
        userMessage = normalizeLineError(userResult, '個別リンク中リッチメニューの確認に失敗しました。');
      }
    }

    return sendJson(res, 200, {
      ok: true,
      defaultRichMenuId,
      defaultStatus,
      defaultMessage,
      userId: userId || null,
      userRichMenuId,
      userStatus,
      userMessage,
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || '反映状態の確認に失敗しました。' });
  }
};
