const { requireAppAuth, sendJson } = require('./_auth');
const { readJsonBody, getLineToken, assertLineApi } = require('./_line');
const MAX_IMAGE_BYTES = 1024 * 1024;

async function uploadRichMenuImage(richMenuId, imageBuffer, contentType, token) {
  const response = await fetch(`https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body: imageBuffer,
  });
  const text = await response.text();
  if (!response.ok) {
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { message: text }; }
    throw new Error(data.message || text || `LINE image upload error: ${response.status}`);
  }
}

function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/);
  if (!match) throw new Error('画像データの形式が不正です。JPEGまたはPNGを使用してください。');
  const contentType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`画像サイズが1MBを超えています。現在: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
  }
  return { buffer, contentType };
}

function validateRichMenu(richMenu, alias = '') {
  if (!richMenu || typeof richMenu !== 'object') throw new Error('リッチメニューJSONがありません。');
  const name = String(richMenu.name || '').trim();
  const chatBarText = String(richMenu.chatBarText || '').trim();
  if (!name) throw new Error('メニュー名がありません。');
  if ([...name].length > 300) throw new Error('メニュー名は300文字以内にしてください。');
  if (!chatBarText) throw new Error('チャットバーテキストがありません。');
  if ([...chatBarText].length > 14) throw new Error('チャットバーテキストは14文字以内にしてください。');
  if (!richMenu.size || !richMenu.size.width || !richMenu.size.height) throw new Error('サイズ指定が不正です。');
  const width = Number(richMenu.size.width);
  const height = Number(richMenu.size.height);
  if (width !== 2500 || ![843, 1686].includes(height)) throw new Error('画像・キャンバス仕様は2500×843または2500×1686を使用してください。');
  if (!Array.isArray(richMenu.areas) || richMenu.areas.length === 0) throw new Error('タップエリアがありません。');
  if (richMenu.areas.length > 20) throw new Error('タップエリアは20個以内にしてください。');
  if (alias && !/^[a-z0-9_-]{1,32}$/i.test(String(alias))) throw new Error('エイリアスIDは32文字以内の半角英数字・_・-で入力してください。');
  richMenu.areas.forEach((area, index) => {
    const bounds = area && area.bounds ? area.bounds : {};
    const x = Number(bounds.x), y = Number(bounds.y), w = Number(bounds.width), h = Number(bounds.height);
    if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width || y + h > height) {
      throw new Error(`エリア${index + 1}の範囲がキャンバス外です。`);
    }
    const action = area && area.action ? area.action : {};
    const type = String(action.type || '').trim();
    if (!['uri', 'message', 'postback', 'richmenuswitch'].includes(type)) throw new Error(`エリア${index + 1}のアクション種類が正しくありません。`);
    if (type === 'uri' && !String(action.uri || '').trim()) throw new Error(`エリア${index + 1}のURLを入力してください。`);
    if (type === 'message' && !String(action.text || '').trim()) throw new Error(`エリア${index + 1}のメッセージを入力してください。`);
    if (type === 'postback' && !String(action.data || '').trim()) throw new Error(`エリア${index + 1}のPostbackデータを入力してください。`);
    if (type === 'richmenuswitch') {
      const target = String(action.richMenuAliasId || '').trim();
      if (!/^[a-z0-9_-]{1,32}$/i.test(target)) throw new Error(`エリア${index + 1}の切替先エイリアスIDを確認してください。`);
    }
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'POSTで送信してください。' });
  }

  try {
    requireAppAuth(req);
  } catch (error) {
    return sendJson(res, error.statusCode || 401, { ok: false, error: error.message || '認証に失敗しました。' });
  }

  let createdRichMenuId = '';
  try {
    const body = await readJsonBody(req, 6 * 1024 * 1024);
    const token = getLineToken(req);
    const { richMenu, imageDataUrl, alias = '', oldRichMenuId = '' } = body;

    validateRichMenu(richMenu, alias);
    const image = parseImageDataUrl(imageDataUrl);

    const created = await assertLineApi('/v2/bot/richmenu', 'POST', token, richMenu);
    createdRichMenuId = created.richMenuId;

    await uploadRichMenuImage(createdRichMenuId, image.buffer, image.contentType, token);

    if (alias) {
      try { await assertLineApi(`/v2/bot/richmenu/alias/${encodeURIComponent(alias)}`, 'DELETE', token); }
      catch (_) {}
      await assertLineApi('/v2/bot/richmenu/alias', 'POST', token, { richMenuAliasId: alias, richMenuId: createdRichMenuId });
    }

    if (oldRichMenuId && oldRichMenuId !== createdRichMenuId) {
      try { await assertLineApi(`/v2/bot/richmenu/${encodeURIComponent(oldRichMenuId)}`, 'DELETE', token); }
      catch (_) {}
    }

    return sendJson(res, 200, { ok: true, richMenuId: createdRichMenuId, alias: alias || null });
  } catch (error) {
    if (createdRichMenuId) {
      try { await assertLineApi(`/v2/bot/richmenu/${encodeURIComponent(createdRichMenuId)}`, 'DELETE', getLineToken(req)); }
      catch (_) {}
    }
    return sendJson(res, 500, { ok: false, error: error.message || 'アップロードに失敗しました。' });
  }
};
