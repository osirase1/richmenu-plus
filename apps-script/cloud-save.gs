const SHEET_NAME = 'クラウド保存一覧';
const LEGACY_SHEET_NAME = 'richmenu_plus_cloud_index';
const FOLDER_NAME = 'RichMenuPlus_CloudData';
const HEADERS_JA = ['クラウドID','クライアント名','保存名','更新日時','DriveファイルID','トークン保存','メニュー数','メモ'];
const FIELD_KEYS = ['cloudId','clientName','projectName','updatedAt','fileId','tokenIncluded','menuCount','note'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  const result = handleRequest(p);
  return output(result, p.callback);
}

function doPost(e) {
  let req = {};
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
    req = raw ? JSON.parse(raw) : {};
  } catch (err) {
    try {
      req = JSON.parse((e && e.parameter && e.parameter.payload) || '{}');
    } catch (err2) {
      req = {};
    }
  }
  return output(handleRequest(req));
}

function output(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function handleRequest(req) {
  const action = String(req.action || 'test');
  if (action === 'test') return testConnection();
  if (action === 'save') return saveProject(req);
  if (action === 'list') return listProjects();
  if (action === 'load') return loadProject(req);
  if (action === 'spreadsheet') return getSpreadsheetInfo();
  return { ok:false, message:'未対応の処理です: ' + action };
}

function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('SPREADSHEET_ID');
  if (savedId) return SpreadsheetApp.openById(savedId);
  const ss = SpreadsheetApp.create('リッチメニュープラス_クラウド保存');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function getSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheetByName(LEGACY_SHEET_NAME);
    if (sheet) {
      try { sheet.setName(SHEET_NAME); } catch (_) {}
    }
  }
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  ensureJapaneseHeaders(sheet);
  return sheet;
}

function ensureJapaneseHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS_JA);
    return;
  }
  const range = sheet.getRange(1, 1, 1, HEADERS_JA.length);
  const current = range.getValues()[0].map(v => String(v || ''));
  const needsUpdate = HEADERS_JA.some((h, i) => current[i] !== h);
  if (needsUpdate) range.setValues([HEADERS_JA]);
}

function getFolder() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('FOLDER_ID');
  if (savedId) return DriveApp.getFolderById(savedId);
  const folder = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function getSpreadsheetInfo() {
  const ss = getSpreadsheet();
  getSheet();
  getFolder();
  return { ok:true, message:'保存先スプレッドシートを取得しました', spreadsheetUrl:ss.getUrl(), spreadsheetId:ss.getId() };
}

function testConnection() {
  const info = getSpreadsheetInfo();
  return { ok:true, message:'接続OK', spreadsheetUrl:info.spreadsheetUrl, spreadsheetId:info.spreadsheetId };
}

function rowsAsObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter(r => r[0]).map((row, i) => {
    const obj = { rowNumber:i + 2 };
    FIELD_KEYS.forEach((key, idx) => obj[key] = row[idx]);
    return obj;
  });
}

function saveProject(req) {
  const sheet = getSheet();
  const folder = getFolder();
  const dataText = typeof req.data === 'string' ? req.data : JSON.stringify(req.data || {});
  const clientName = String(req.clientName || '未設定クライアント');
  const projectName = String(req.projectName || 'リッチメニュー');
  const cloudId = String(req.cloudId || Utilities.getUuid());
  const rows = rowsAsObjects(sheet);
  let row = rows.find(r => String(r.cloudId) === cloudId) || rows.find(r => String(r.clientName) === clientName && String(r.projectName) === projectName);
  let file;
  if (row && row.fileId) {
    file = DriveApp.getFileById(String(row.fileId));
    file.setContent(dataText);
  } else {
    file = folder.createFile(cloudId + '.json', dataText, MimeType.PLAIN_TEXT);
  }
  const dataObj = JSON.parse(dataText);
  const values = [
    cloudId,
    clientName,
    projectName,
    new Date(),
    file.getId(),
    dataObj.tokenIncluded ? 'あり' : 'なし',
    Array.isArray(dataObj.menus) ? dataObj.menus.length : '',
    req.note || ''
  ];
  if (row) sheet.getRange(row.rowNumber, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
  return { ok:true, message:'クラウド保存しました', cloudId:cloudId, spreadsheetUrl:getSpreadsheet().getUrl() };
}

function listProjects() {
  const sheet = getSheet();
  const list = rowsAsObjects(sheet).map(r => ({
    cloudId:String(r.cloudId || ''),
    clientName:String(r.clientName || ''),
    projectName:String(r.projectName || ''),
    updatedAt:r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt || ''),
    tokenIncluded:String(r.tokenIncluded || ''),
    menuCount:String(r.menuCount || '')
  })).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return { ok:true, list:list, spreadsheetUrl:getSpreadsheet().getUrl() };
}

function loadProject(req) {
  const sheet = getSheet();
  const cloudId = String(req.cloudId || '');
  const rows = rowsAsObjects(sheet);
  const row = rows.find(r => String(r.cloudId) === cloudId);
  if (!row) return { ok:false, message:'保存データが見つかりません' };
  const text = DriveApp.getFileById(String(row.fileId)).getBlob().getDataAsString('UTF-8');
  return { ok:true, data:JSON.parse(text), item:{ cloudId:cloudId, clientName:row.clientName, projectName:row.projectName, updatedAt:row.updatedAt } };
}
