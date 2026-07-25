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
  if (action === 'normalizeHeaders' || action === 'japaneseHeaders') return normalizeSpreadsheetHeaders();
  if (action === 'dedupe' || action === 'cleanupDuplicates') return cleanupDuplicateRows();
  if (action === 'delete' || action === 'deleteProject' || action === 'cloudDelete') return deleteProject(req);
  if (action === 'organizeSheet' || action === 'formatSheet' || action === 'cleanupSheet') return organizeSpreadsheet();
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
  } else {
    // 既存シートが英語見出しの場合も、1行目を必ず日本語に揃えます。
    // データ行は触らないので、保存済みデータは残ります。
    const range = sheet.getRange(1, 1, 1, HEADERS_JA.length);
    const current = range.getValues()[0].map(v => String(v || ''));
    const needsUpdate = HEADERS_JA.some((h, i) => current[i] !== h);
    if (needsUpdate) range.setValues([HEADERS_JA]);
  }
  try { sheet.setFrozenRows(1); } catch (_) {}
  try { sheet.autoResizeColumns(1, HEADERS_JA.length); } catch (_) {}
}

function normalizeSpreadsheetHeaders() {
  const ss = getSpreadsheet();
  const sheet = getSheet();
  ensureJapaneseHeaders(sheet);
  const headers = sheet.getRange(1, 1, 1, HEADERS_JA.length).getValues()[0];
  return {
    ok:true,
    message:'スプレッドシートの項目名を日本語に更新しました。',
    spreadsheetUrl:ss.getUrl(),
    spreadsheetId:ss.getId(),
    sheetName:sheet.getName(),
    headers:headers
  };
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
  const sheet = getSheet();
  getFolder();
  const headers = sheet.getRange(1, 1, 1, HEADERS_JA.length).getValues()[0];
  return { ok:true, message:'保存先スプレッドシートを取得しました', spreadsheetUrl:ss.getUrl(), spreadsheetId:ss.getId(), sheetName:sheet.getName(), headers:headers };
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


function rowUpdatedTime(row) {
  const v = row && row.updatedAt;
  if (v instanceof Date) return v.getTime();
  const t = Date.parse(String(v || ''));
  return isNaN(t) ? 0 : t;
}

function rowNameKey(row) {
  return String(row && row.clientName || '').trim() + '::' + String(row && row.projectName || '').trim();
}

function findRowsForSave(rows, cloudId, clientName, projectName) {
  const targetCloudId = String(cloudId || '').trim();
  const targetNameKey = String(clientName || '').trim() + '::' + String(projectName || '').trim();
  return rows.filter(row => {
    const rowCloudId = String(row.cloudId || '').trim();
    return (targetCloudId && rowCloudId === targetCloudId) || rowNameKey(row) === targetNameKey;
  }).sort((a, b) => {
    const timeDiff = rowUpdatedTime(b) - rowUpdatedTime(a);
    return timeDiff || ((b.rowNumber || 0) - (a.rowNumber || 0));
  });
}

function trashFileIfSafe(fileId, keepFileId) {
  const id = String(fileId || '').trim();
  if (!id || id === String(keepFileId || '').trim()) return false;
  try {
    DriveApp.getFileById(id).setTrashed(true);
    return true;
  } catch (_) {
    return false;
  }
}

function deleteRowsDescending(sheet, rowNumbers) {
  const unique = Array.from(new Set(rowNumbers.map(n => Number(n)).filter(n => n > 1))).sort((a, b) => b - a);
  unique.forEach(rowNumber => sheet.deleteRow(rowNumber));
  return unique.length;
}

function removeDuplicateRowsAfterSave(sheet, rows, keepRow, keepFileId) {
  if (!keepRow) return 0;
  const keepCloudId = String(keepRow.cloudId || '').trim();
  const keepNameKey = rowNameKey(keepRow);
  const deleteTargets = rows.filter(row => row.rowNumber !== keepRow.rowNumber && (
    (keepCloudId && String(row.cloudId || '').trim() === keepCloudId) || rowNameKey(row) === keepNameKey
  ));
  deleteTargets.forEach(row => trashFileIfSafe(row.fileId, keepFileId));
  return deleteRowsDescending(sheet, deleteTargets.map(row => row.rowNumber));
}

function dedupeRowsForList(rows) {
  const sorted = rows.slice().sort((a, b) => {
    const timeDiff = rowUpdatedTime(b) - rowUpdatedTime(a);
    return timeDiff || ((b.rowNumber || 0) - (a.rowNumber || 0));
  });
  const seenCloudIds = {};
  const seenNameKeys = {};
  const keep = [];
  sorted.forEach(row => {
    const cloudId = String(row.cloudId || '').trim();
    const nameKey = rowNameKey(row);
    if ((cloudId && seenCloudIds[cloudId]) || seenNameKeys[nameKey]) return;
    if (cloudId) seenCloudIds[cloudId] = true;
    seenNameKeys[nameKey] = true;
    keep.push(row);
  });
  return keep;
}

function cleanupDuplicateRows() {
  const ss = getSpreadsheet();
  const sheet = getSheet();
  const rows = rowsAsObjects(sheet);
  const keep = dedupeRowsForList(rows);
  const keepRowNumbers = {};
  const keepFileIds = {};
  keep.forEach(row => {
    keepRowNumbers[row.rowNumber] = true;
    const id = String(row.fileId || '').trim();
    if (id) keepFileIds[id] = true;
  });
  const deleteTargets = rows.filter(row => !keepRowNumbers[row.rowNumber]);
  let trashedFiles = 0;
  deleteTargets.forEach(row => {
    const id = String(row.fileId || '').trim();
    if (id && !keepFileIds[id] && trashFileIfSafe(id, '')) trashedFiles++;
  });
  const removedRows = deleteRowsDescending(sheet, deleteTargets.map(row => row.rowNumber));
  ensureJapaneseHeaders(sheet);
  return {
    ok:true,
    message: removedRows ? '重複データを整理しました。' : '重複データはありませんでした。',
    removedRows:removedRows,
    keptRows:keep.length,
    trashedFiles:trashedFiles,
    spreadsheetUrl:ss.getUrl(),
    list:dedupeRowsForList(rowsAsObjects(sheet)).map(r => ({
      cloudId:String(r.cloudId || ''),
      clientName:String(r.clientName || ''),
      projectName:String(r.projectName || ''),
      updatedAt:r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt || ''),
      tokenIncluded:String(r.tokenIncluded || ''),
      menuCount:String(r.menuCount || '')
    }))
  };
}


function removeCompletelyEmptyRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const lastCol = Math.max(sheet.getLastColumn(), HEADERS_JA.length);
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const deleteTargets = [];
  values.forEach((row, idx) => {
    const isEmpty = row.every(v => String(v || '').trim() === '');
    if (isEmpty) deleteTargets.push(idx + 2);
  });
  return deleteRowsDescending(sheet, deleteTargets);
}

function sortRowsByUpdatedAt(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return false;
  const lastCol = Math.max(sheet.getLastColumn(), HEADERS_JA.length);
  sheet.getRange(2, 1, lastRow - 1, lastCol).sort({ column: 4, ascending: false });
  return true;
}

function styleSpreadsheet(sheet) {
  ensureJapaneseHeaders(sheet);
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = Math.max(sheet.getLastColumn(), HEADERS_JA.length);
  const headerRange = sheet.getRange(1, 1, 1, HEADERS_JA.length);
  headerRange
    .setBackground('#06c755')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  try { sheet.setFrozenRows(1); } catch (_) {}
  try { sheet.getRange(1, 1, lastRow, lastCol).setVerticalAlignment('middle'); } catch (_) {}
  try { sheet.getRange(2, 4, Math.max(lastRow - 1, 1), 1).setNumberFormat('yyyy/mm/dd hh:mm:ss'); } catch (_) {}
  try { sheet.autoResizeColumns(1, HEADERS_JA.length); } catch (_) {}
  try { sheet.setColumnWidth(1, 210); } catch (_) {}
  try { sheet.setColumnWidth(2, 160); } catch (_) {}
  try { sheet.setColumnWidth(3, 180); } catch (_) {}
  try { sheet.setColumnWidth(4, 150); } catch (_) {}
  try { sheet.setColumnWidth(5, 220); } catch (_) {}
  try { sheet.setColumnWidth(7, 90); } catch (_) {}
  try { sheet.setColumnWidth(8, 220); } catch (_) {}
  try { sheet.hideColumns(6); } catch (_) {}
}

function organizeSpreadsheet() {
  const ss = getSpreadsheet();
  const sheet = getSheet();
  ensureJapaneseHeaders(sheet);
  const removedEmptyRows = removeCompletelyEmptyRows(sheet);
  const duplicateResult = cleanupDuplicateRows();
  const removedDuplicateRows = Number(duplicateResult && duplicateResult.removedRows || 0);
  sortRowsByUpdatedAt(sheet);
  styleSpreadsheet(sheet);
  const list = listProjectItems();
  return {
    ok:true,
    message:'スプレッドシートを整理しました。見出し固定・列幅調整・更新日時順並び替え・トークン列非表示・重複/空白行整理を行いました。',
    spreadsheetUrl:ss.getUrl(),
    spreadsheetId:ss.getId(),
    sheetName:sheet.getName(),
    removedEmptyRows:removedEmptyRows,
    removedDuplicateRows:removedDuplicateRows,
    list:list
  };
}

function saveProject(req) {
  const sheet = getSheet();
  const folder = getFolder();
  const dataText = typeof req.data === 'string' ? req.data : JSON.stringify(req.data || {});
  const clientName = String(req.clientName || '未設定クライアント').trim() || '未設定クライアント';
  const projectName = String(req.projectName || 'リッチメニュー').trim() || 'リッチメニュー';
  const requestedCloudId = String(req.cloudId || '').trim();
  const cloudId = requestedCloudId || Utilities.getUuid();
  const rows = rowsAsObjects(sheet);
  const matches = findRowsForSave(rows, cloudId, clientName, projectName);
  const row = matches[0] || null;
  let file;
  if (row && row.fileId) {
    try {
      file = DriveApp.getFileById(String(row.fileId));
      file.setContent(dataText);
    } catch (_) {
      file = folder.createFile(cloudId + '.json', dataText, MimeType.PLAIN_TEXT);
    }
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
  let removedDuplicates = 0;
  if (row) {
    sheet.getRange(row.rowNumber, 1, 1, values.length).setValues([values]);
    const keepRow = Object.assign({}, row, {
      cloudId: cloudId,
      clientName: clientName,
      projectName: projectName,
      updatedAt: values[3],
      fileId: file.getId()
    });
    removedDuplicates = removeDuplicateRowsAfterSave(sheet, rows, keepRow, file.getId());
  } else {
    sheet.appendRow(values);
  }
  return { ok:true, message:removedDuplicates ? 'クラウド保存しました。重複データも整理しました。' : 'クラウド保存しました', cloudId:cloudId, removedDuplicates:removedDuplicates, spreadsheetUrl:getSpreadsheet().getUrl() };
}


function deleteProject(req) {
  const ss = getSpreadsheet();
  const sheet = getSheet();
  const rows = rowsAsObjects(sheet);
  const cloudId = String(req.cloudId || '').trim();
  const clientName = String(req.clientName || '').trim();
  const projectName = String(req.projectName || '').trim();
  if (!cloudId && (!clientName || !projectName)) {
    return { ok:false, message:'削除対象のクラウドID、またはクライアント名＋保存名がありません。' };
  }

  const targetNameKey = clientName && projectName ? (clientName + '::' + projectName) : '';
  const targets = rows.filter(row => {
    const rowCloudId = String(row.cloudId || '').trim();
    if (cloudId && rowCloudId === cloudId) return true;
    return targetNameKey && rowNameKey(row) === targetNameKey;
  });

  if (!targets.length) {
    return {
      ok:true,
      message:'削除対象は見つかりませんでした。すでに削除済みの可能性があります。',
      deletedRows:0,
      trashedFiles:0,
      spreadsheetUrl:ss.getUrl(),
      list:listProjectItems()
    };
  }

  let trashedFiles = 0;
  targets.forEach(row => {
    const id = String(row.fileId || '').trim();
    if (id && trashFileIfSafe(id, '')) trashedFiles++;
  });
  const deletedRows = deleteRowsDescending(sheet, targets.map(row => row.rowNumber));
  ensureJapaneseHeaders(sheet);
  return {
    ok:true,
    message:'クラウド保存データを削除しました。スプレッドシートの行とDrive保存ファイルを削除対象にしました。',
    deletedRows:deletedRows,
    trashedFiles:trashedFiles,
    spreadsheetUrl:ss.getUrl(),
    list:listProjectItems()
  };
}

function listProjectItems() {
  const sheet = getSheet();
  const rows = rowsAsObjects(sheet);
  return dedupeRowsForList(rows).map(r => ({
    cloudId:String(r.cloudId || ''),
    clientName:String(r.clientName || ''),
    projectName:String(r.projectName || ''),
    updatedAt:r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt || ''),
    tokenIncluded:String(r.tokenIncluded || ''),
    menuCount:String(r.menuCount || '')
  })).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function listProjects() {
  const sheet = getSheet();
  const rows = rowsAsObjects(sheet);
  const list = listProjectItems();
  const duplicateCount = Math.max(0, rows.length - list.length);
  return { ok:true, list:list, duplicateCount:duplicateCount, spreadsheetUrl:getSpreadsheet().getUrl() };
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
