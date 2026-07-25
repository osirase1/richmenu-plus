function readJsonBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > maxBytes) {
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

function getLineToken(req) {
  const fromHeader = String(req.headers['x-line-token'] || '').trim();
  const token = fromHeader || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error('チャネルアクセストークンがありません。画面のLINEタブに入力するか、Vercelの環境変数 LINE_CHANNEL_ACCESS_TOKEN に設定してください。');
  }
  return token;
}

async function requestLineApi(path, method, token, body) {
  const headers = { Authorization: `Bearer ${token}` };
  const options = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`https://api.line.me${path}`, options);
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch (_) { data = { message: text }; }
  return { ok: response.ok, status: response.status, data, text };
}

async function assertLineApi(path, method, token, body) {
  const result = await requestLineApi(path, method, token, body);
  if (!result.ok) {
    const message = result.data && result.data.message ? result.data.message : result.text;
    throw new Error(message || `LINE API error: ${result.status}`);
  }
  return result.data;
}

function normalizeLineError(result, fallback) {
  if (result.status === 404) return null;
  const message = result.data && result.data.message ? result.data.message : result.text;
  return message || fallback || `LINE API error: ${result.status}`;
}

module.exports = {
  readJsonBody,
  getLineToken,
  requestLineApi,
  assertLineApi,
  normalizeLineError,
};
