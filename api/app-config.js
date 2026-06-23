const { getAppMode, sendJson } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'GETまたはPOSTで送信してください。' });
  }
  const mode = getAppMode();
  return sendJson(res, 200, {
    ok: true,
    mode,
    passwordRequired: mode === 'client',
  });
};
