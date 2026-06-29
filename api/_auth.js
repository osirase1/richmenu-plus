function getAppMode() {
  return 'owner';
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function requireAppAuth() {
  return { ok: true, mode: 'owner' };
}

module.exports = {
  getAppMode,
  sendJson,
  requireAppAuth,
};
