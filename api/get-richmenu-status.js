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

async function lineApi(path, method, token) {
  const response = await fetch(`https://api.line.me${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { message: text }; }
  return { ok: response.ok, status: response.status, data, text };
}

function normalizeLineError(result, fallback) {
  if (result.status === 404) return null;
  const msg = result.data && result.data.message ? result.data.message : result.text;
  return msg || fallback || `LINE API error: ${result.status}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'POSTで送信してください。' });
  }

  try {
    requireAppAuth(req);
    const body = await readJsonBody(req);
    const token = getToken(req);
    const userId = String(body.userId || '').trim();

    const defaultResult = await lineApi('/v2/bot/user/all/richmenu', 'GET', token);
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
      const userResult = await lineApi(`/v2/bot/user/${encodeURIComponent(userId)}/richmenu`, 'GET', token);
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
