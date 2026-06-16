const MAX_IMAGE_BYTES = 1024 * 1024;


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
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 6 * 1024 * 1024) {
        reject(new Error('送信データが大きすぎます。画像を軽くしてください。'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error('JSONの読み込みに失敗しました。'));
      }
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
  if (!response.ok) {
    throw new Error(data.message || text || `LINE API error: ${response.status}`);
  }
  return data;
}

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

function validateRichMenu(richMenu) {
  if (!richMenu || typeof richMenu !== 'object') throw new Error('リッチメニューJSONがありません。');
  if (!richMenu.name) throw new Error('メニュー名がありません。');
  if (!richMenu.chatBarText) throw new Error('チャットバーテキストがありません。');
  if (!richMenu.size || !richMenu.size.width || !richMenu.size.height) throw new Error('サイズ指定が不正です。');
  if (!Array.isArray(richMenu.areas) || richMenu.areas.length === 0) throw new Error('タップエリアがありません。');
  if (richMenu.areas.length > 20) throw new Error('タップエリアは20個以内にしてください。');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'POSTで送信してください。' });
  }

  try {
    requireAppPassword(req);
  } catch (error) {
    return sendJson(res, error.statusCode || 401, { ok: false, error: error.message || '認証に失敗しました。' });
  }

  let createdRichMenuId = '';
  try {
    const body = await readJsonBody(req);
    const token = getToken(req);
    const { richMenu, imageDataUrl, alias = '', oldRichMenuId = '' } = body;

    validateRichMenu(richMenu);
    const image = parseImageDataUrl(imageDataUrl);

    const created = await lineApi('/v2/bot/richmenu', 'POST', richMenu, token);
    createdRichMenuId = created.richMenuId;

    await uploadRichMenuImage(createdRichMenuId, image.buffer, image.contentType, token);

    if (alias) {
      try {
        await lineApi(`/v2/bot/richmenu/alias/${encodeURIComponent(alias)}`, 'DELETE', undefined, token);
      } catch (_) {}
      await lineApi('/v2/bot/richmenu/alias', 'POST', {
        richMenuAliasId: alias,
        richMenuId: createdRichMenuId,
      }, token);
    }

    if (oldRichMenuId && oldRichMenuId !== createdRichMenuId) {
      try {
        await lineApi(`/v2/bot/richmenu/${encodeURIComponent(oldRichMenuId)}`, 'DELETE', undefined, token);
      } catch (_) {}
    }

    return sendJson(res, 200, {
      ok: true,
      richMenuId: createdRichMenuId,
      alias: alias || null,
    });
  } catch (error) {
    if (createdRichMenuId) {
      try {
        await lineApi(`/v2/bot/richmenu/${encodeURIComponent(createdRichMenuId)}`, 'DELETE', undefined, getToken(req));
      } catch (_) {}
    }
    return sendJson(res, 500, { ok: false, error: error.message || 'アップロードに失敗しました。' });
  }
};
