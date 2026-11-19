/**
 * KONFIGURASI SISTEM — VOLTAKE GROUND WORK REPORT
 * Versi: 4.2 — DEPARTMENT: PSS
 *
 * PENTING: Fail ini untuk projek Apps Script PSS sahaja.
 *
 * PERUBAHAN v4.2:
 * - Lajur tidak terpakai (Add Attach (PDF), Submission Inv, Status Inv) dibuang
 *   oleh cleanupDuplicateColumns(). Sheet akhir: 36 lajur.
 *
 * PERUBAHAN v4.1:
 * 1. Ikut nama header SEBENAR dalam sheet: manpower masuk lajur "Manpower",
 *    gambar masuk "DraftImageData". Tiada lagi lajur pendua.
 * 2. Lajur ManpowerData & JobItemsData dibuang — maklumat sama sudah ada dalam
 *    "Manpower" dan "JobDesc".
 * 3. Job shutdown kini ada voltan LV / MV. Lajur JobShutdown: NO / YES - LV / YES - MV / YES - LV/MV.
 * 4. Lajur baru PTW (Permit To Work): YES / NO.
 * 5. cleanupDuplicateColumns() — kemas lajur pendua yang dicipta oleh v4.0.
 *
 * DARI v4.0 (kekal):
 * - Lajur dicari ikut NAMA header. Header yang tiada ditambah di HUJUNG lajur terakhir.
 * - LockService — dua request serentak tidak boleh tulis atas baris yang sama.
 * - Anti-ulangan (clientReqId) untuk PSS dan OMP.
 * - Selepas klien sign, pautan Final PDF dihantar ke emel staff.
 * - delete_report perlukan PIN admin (Script Properties: DELETE_PIN).
 * - Hanya lajur yang berubah ditulis — telefon tak hilang sifar depan, lajur
 *   manual anda (Approval Manager) tidak disentuh.
 * - Laporan Approved tidak boleh ditimpa oleh save_draft / submit_report.
 *
 * SELEPAS PASTE KOD INI:
 * - Jalankan cleanupDuplicateColumns() SEKALI dari editor — buang lajur pendua v4.0
 *   (Remarks, DraftImagesData, JobItemsData, ManpowerData) dan lajur tidak terpakai
 *   (Add Attach (PDF), Submission Inv, Status Inv). Backup sheet dibuat dahulu.
 * - Jalankan checkSetup() sekali (beri kebenaran & semak tetapan).
 * - Deploy > Manage deployments > Edit (ikon pensel) > Version: New version > Deploy.
 *   JANGAN buat "New deployment" — URL akan bertukar dan borang tidak boleh hantar.
 */

const DEPT           = 'PSS';
const SPREADSHEET_ID = '1YzuL8A0rBTDb8DA3kcb5VT7h9tOwrSucSsIpnyi6aCk';
const ROOT_DRIVE_ID  = '1YaHD3ef5GLkIkhQ2hYSsDi2mrCI0mYJu';
const SHEET_NAME     = 'Reports';
const TIMEZONE       = 'Asia/Kuala_Lumpur';

// Had baris terakhir yang discan untuk carian draf (elak scan beribu baris lama)
const SEARCH_SCAN_LIMIT = 800;

// Berapa lama request menunggu giliran untuk tulis ke sheet
const LOCK_WAIT_MS = 30000;

// PIN padam laporan — set dalam Project Settings > Script Properties
const DELETE_PIN_PROP    = 'DELETE_PIN';
const DELETE_MAX_FAILS   = 5;     // cubaan PIN salah sebelum dikunci
const DELETE_LOCKOUT_SEC = 600;   // tempoh kunci (10 minit)

// Lajur yang sistem baca/tulis. Lajur manual anda (Approval Manager) tidak
// perlu disenaraikan — sistem tidak akan sentuh lajur tersebut.
const HEADERS = [
  'ReportID', 'Timestamp', 'Date', 'PONumber', 'QuotationNumber', 'MOSNumber',
  'ClientCompany', 'ProjectTitle', 'Location', 'TimeIn', 'TimeOut',
  'PICName', 'PICPhone', 'JobDesc', 'UnresolvedIssue', 'Manpower',
  'StaffName', 'StaffPosition', 'StaffSignatureId', 'DraftPdfId',
  'StaffToken', 'ApprovalToken', 'Status', 'ClientSignName', 'ClientSignPosition',
  'ClientSignPhone', 'ClientSignatureId', 'FinalPdfId', 'ClientEmail', 'ClientPhone',
  'DraftImageData',
  // Lajur tambahan sistem
  'ClientReqId',   // kunci anti-ulangan untuk offline queue
  'StaffEmail',    // emel staff — terima Final PDF selepas klien sign
  'JobShutdown',   // NO / YES - LV / YES - MV / YES - LV/MV
  'PTW'            // Permit To Work: YES / NO
];

/**
 * Nama lain bagi lajur yang sama. Kalau sheet guna nama lain ini, sistem
 * guna lajur itu dan TIDAK cipta lajur baru.
 */
const HEADER_ALIASES = {
  'Manpower': ['Remarks'],
  'DraftImageData': ['DraftImagesData']
};

// Lajur yang dibuang oleh cleanupDuplicateColumns():
// - pendua yang dicipta oleh v4.0
// - lajur manual yang tidak terpakai
const REMOVED_COLUMNS = [
  'Remarks', 'DraftImagesData', 'JobItemsData', 'ManpowerData',
  'Add Attach (PDF)', 'Submission Inv', 'Status Inv'
];

const VOLTAGES = ['LV', 'MV'];

/* =========================================================
   HELPER ASAS
   ========================================================= */

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function fmtDate(d) {
  if (Object.prototype.toString.call(d) === '[object Date]' && !isNaN(d.getTime())) {
    return Utilities.formatDate(d, TIMEZONE, 'dd/MM/yyyy');
  }
  return d ? String(d) : '';
}

function parseJsonArray(value) {
  try {
    const arr = JSON.parse(value || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

/**
 * Hanya satu request boleh tulis ke sheet pada satu masa.
 * Tanpa kunci, dua technician yang hantar serentak boleh dapat nombor baris
 * yang sama dari getLastRow() dan seorang akan menulis atas rekod yang lain.
 */
function withLock(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) throw new Error('Server sibuk. Sila cuba sebentar lagi.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
   SHEET — LAJUR IKUT NAMA HEADER
   ========================================================= */

function readHeader(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });
}

/**
 * Buka sheet dan bina peta lajur ikut NAMA header.
 *
 * Header yang belum wujud ditambah di HUJUNG lajur terakhir yang ada apa-apa
 * data (getLastColumn), jadi ia tidak akan bertindan dengan data sedia ada.
 * Susunan lajur dalam sheet tidak lagi penting — anda boleh tambah lajur
 * sendiri atau susun semula tanpa merosakkan sistem.
 */
function openContext() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  let header = readHeader(sheet);
  const hasMissing = missingHeaders(header).length > 0;

  if (hasMissing) {
    // Kunci supaya dua request serentak tidak tambah header yang sama dua kali
    withLock(function () {
      header = readHeader(sheet);
      const missing = missingHeaders(header);
      if (!missing.length) return;

      const startCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, startCol, 1, missing.length).setValues([missing])
        .setFontWeight('bold').setBackground('#e0e0e0');
      if (sheet.getFrozenRows() === 0) sheet.setFrozenRows(1);
      header = readHeader(sheet);
    });
  }

  const cols = {};
  header.forEach(function (h, i) { if (h && !cols[h]) cols[h] = i + 1; });
  // Nama logik -> lajur nama lain, kalau nama utama tiada dalam sheet
  Object.keys(HEADER_ALIASES).forEach(function (name) {
    if (cols[name]) return;
    const alias = HEADER_ALIASES[name].filter(function (a) { return cols[a]; })[0];
    if (alias) cols[name] = cols[alias];
  });
  return { sheet: sheet, cols: cols, width: header.length };
}

/** Header sistem yang belum wujud (nama utama ATAU nama lain dikira wujud). */
function missingHeaders(header) {
  return HEADERS.filter(function (h) {
    if (header.indexOf(h) > -1) return false;
    return !(HEADER_ALIASES[h] || []).some(function (a) { return header.indexOf(a) > -1; });
  });
}

/** Dikekalkan untuk keserasian — boleh dijalankan manual dari editor. */
function setupSystem() {
  return openContext().sheet;
}

/** Cari baris dengan baca SATU lajur sahaja. */
function findRow(ctx, headerName, value) {
  if (value === '' || value === null || value === undefined) return -1;
  const col = ctx.cols[headerName];
  const lastRow = ctx.sheet.getLastRow();
  if (!col || lastRow < 2) return -1;

  const values = ctx.sheet.getRange(2, col, lastRow - 1, 1).getValues();
  const target = value.toString().trim();
  for (let i = 0; i < values.length; i++) {
    if (values[i][0].toString().trim() === target) return i + 2; // +2 sebab mula baris 2
  }
  return -1;
}

function rowToObject(ctx, values) {
  const obj = {};
  Object.keys(ctx.cols).forEach(function (h) { obj[h] = values[ctx.cols[h] - 1]; });
  // Baris yang ditulis oleh v4.0 ke lajur pendua (sebelum cleanup dijalankan)
  Object.keys(HEADER_ALIASES).forEach(function (name) {
    if (obj[name] !== '' && obj[name] !== undefined && obj[name] !== null) return;
    HEADER_ALIASES[name].forEach(function (a) {
      if ((obj[name] === '' || obj[name] === undefined) && obj[a]) obj[name] = obj[a];
    });
  });
  return obj;
}

function readRow(ctx, rowIndex) {
  return rowToObject(ctx, ctx.sheet.getRange(rowIndex, 1, 1, ctx.width).getValues()[0]);
}

/**
 * Tulis HANYA lajur yang diberi. Lajur bersebelahan dikumpul supaya setiap
 * kumpulan cuma satu setValues().
 *
 * Versi lama baca dan tulis semula SELURUH baris. Akibatnya nombor telefon
 * (disimpan sebagai teks "0123...") ditulis semula sebagai nombor dan sifar
 * di depan hilang, dan formula dalam lajur lain bertukar jadi nilai biasa.
 */
function writeRow(ctx, rowIndex, valuesMap) {
  // Jangan sekali-kali tulis atas baris header
  if (!rowIndex || rowIndex < 2) throw new Error('Baris sasaran tidak sah: ' + rowIndex);

  const cells = Object.keys(valuesMap)
    .filter(function (h) { return ctx.cols[h]; })
    .map(function (h) { return { col: ctx.cols[h], value: valuesMap[h] }; })
    .sort(function (a, b) { return a.col - b.col; });

  let i = 0;
  while (i < cells.length) {
    let j = i;
    while (j + 1 < cells.length && cells[j + 1].col === cells[j].col + 1) j++;
    const run = cells.slice(i, j + 1).map(function (c) { return c.value; });
    ctx.sheet.getRange(rowIndex, cells[i].col, 1, run.length).setValues([run]);
    i = j + 1;
  }
}

/** ReportID unik (mesti dipanggil dalam withLock). Format kekal REP-<masa>. */
function newReportId(ctx) {
  let t = new Date().getTime();
  while (findRow(ctx, 'ReportID', 'REP-' + t) !== -1) t++;
  return 'REP-' + t;
}

/**
 * CIPTA BARIS BARU DENGAN SELAMAT (mesti dipanggil dalam withLock)
 *
 * appendRow() dengan baris yang semuanya kosong TIDAK menghasilkan kandungan,
 * jadi getLastRow() masih pulangkan baris lama. ReportID dan Timestamp diisi
 * supaya baris itu benar-benar ada kandungan sebelum getLastRow() dipanggil.
 */
function appendNewRow(ctx, reportId) {
  const newRow = new Array(ctx.width).fill('');
  newRow[ctx.cols['ReportID'] - 1] = reportId;
  newRow[ctx.cols['Timestamp'] - 1] = new Date();
  ctx.sheet.appendRow(newRow);

  const rowIndex = ctx.sheet.getLastRow();
  if (rowIndex < 2) throw new Error('Ralat struktur sheet: baris baru tidak dapat dicipta.');
  return rowIndex;
}

/**
 * ANTI-ULANGAN (IDEMPOTENCY)
 * Bila internet lemah, kadang-kadang data sampai ke server tapi jawapan balik
 * hilang di tengah jalan. Phone ingat gagal, lalu hantar semula. Setiap
 * penghantaran bawa clientReqId yang unik — kalau ID itu sudah wujud, kita
 * pulangkan hasil lama, bukan simpan rekod baru.
 */
function findDuplicateResponse(ctx, clientReqId) {
  if (!clientReqId) return null;

  const rowIndex = findRow(ctx, 'ClientReqId', clientReqId);
  if (rowIndex === -1) return null;

  const r = readRow(ctx, rowIndex);
  return {
    status: 'success',
    duplicate: true,
    message: 'Rekod ini telah pun diterima sebelum ini.',
    staffToken: r['StaffToken'],
    reportId: r['ReportID'],
    approvalLink: r['ApprovalToken'] ? (ScriptApp.getService().getUrl() + '?token=' + r['ApprovalToken']) : '',
    finalPdfLink: r['FinalPdfId'] ? ('https://drive.google.com/file/d/' + r['FinalPdfId'] + '/view') : ''
  };
}

function assertNotApproved(row) {
  if (String(row['Status'] || '') === 'Approved') {
    throw new Error('Laporan ' + row['ReportID'] + ' sudah Approved oleh klien dan tidak boleh diubah. ' +
      'Tekan "Borang Baru" untuk laporan seterusnya.');
  }
}

/* =========================================================
   DATA BARU — JOB SHUTDOWN (LV/MV), PTW, EMEL STAFF
   ========================================================= */

function cleanJobItems(arr) {
  if (!Array.isArray(arr)) return null;
  return arr.map(function (j) {
    j = j || {};
    const shutdown = j.shutdown === true;
    return {
      desc: String(j.desc || ''),
      remark: String(j.remark || ''),
      shutdown: shutdown,
      voltage: (shutdown && VOLTAGES.indexOf(j.voltage) > -1) ? j.voltage : ''
    };
  }).filter(function (j) { return j.desc || j.remark; });
}

/** Ringkasan untuk lajur JobShutdown: NO / YES - LV / YES - MV / YES - LV/MV */
function shutdownSummary(jobs) {
  const sd = jobs.filter(function (j) { return j.shutdown; });
  if (!sd.length) return 'NO';
  const volts = VOLTAGES.filter(function (v) {
    return sd.some(function (j) { return j.voltage === v; });
  });
  return volts.length ? 'YES - ' + volts.join('/') : 'YES';
}

/**
 * Lajur baru hanya ditulis bila frontend baru menghantar data tersebut.
 * Phone yang masih guna versi lama (cache) tidak akan mengosongkan lajur ini.
 * JobShutdown dikira di server, bukan dipercayai dari frontend.
 */
function newFieldValues(payload) {
  const out = {};

  const jobs = cleanJobItems(payload.jobItems);
  if (jobs) out['JobShutdown'] = shutdownSummary(jobs);

  if (Object.prototype.hasOwnProperty.call(payload, 'ptw')) {
    out['PTW'] = payload.ptw === 'YES' ? 'YES' : 'NO';
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'staffEmail')) {
    out['StaffEmail'] = String(payload.staffEmail || '').trim();
  }
  return out;
}

/* =========================================================
   GOOGLE DRIVE
   ========================================================= */

function buildFolderName(loc, client, dateStr) {
  let d = dateStr || '';
  if (d instanceof Date) {
    const day = ("0" + d.getDate()).slice(-2);
    const month = ("0" + (d.getMonth() + 1)).slice(-2);
    d = day + month + d.getFullYear();
  } else if (typeof d === 'string' && d.indexOf('-') > -1) {
    const parts = d.split('T')[0].split('-');
    if (parts.length === 3) d = parts[2] + parts[1] + parts[0];
  }

  const l = (loc || 'Location').toString().split(',')[0].trim()
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const c = (client || 'Client').toString().trim()
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

  return l + '_' + c + '_' + d;
}

function getOrCreateFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return parentFolder.createFolder(folderName);
}

function saveFileToDrive(base64Data, filename, subFolderName) {
  if (!base64Data || base64Data.indexOf('base64,') === -1) return null;
  const rootFolder = DriveApp.getFolderById(ROOT_DRIVE_ID);
  const subFolder = getOrCreateFolder(rootFolder, subFolderName);

  const splitBase = base64Data.split(',');
  const contentType = splitBase[0].split(':')[1].split(';')[0];
  const bytes = Utilities.base64Decode(splitBase[1]);
  const blob = Utilities.newBlob(bytes, contentType, filename);

  const file = subFolder.createFile(blob);
  // Perlu kekal "anyone with link": klien buka PDF dalam halaman Approval
  // dan pautan emel tanpa log masuk akaun Google syarikat.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getId();
}

/** Gambar: sokong dua cara — id sahaja (dah upload dulu), atau base64 (cara lama). */
function saveImages(images, folderName) {
  const saved = [];
  (images || []).forEach(function (img, idx) {
    if (!img) return;
    if (img.id) {
      saved.push({ id: String(img.id), desc: img.desc || '' });
    } else if (img.base64) {
      const filename = folderName + '_Image_' + new Date().getTime() + '_' + idx + '.jpg';
      const fileId = saveFileToDrive(img.base64, filename, folderName);
      if (fileId) saved.push({ id: fileId, desc: img.desc || '' });
    }
  });
  return saved;
}

function trashFileSafe(fileId) {
  if (!fileId) return false;
  try {
    DriveApp.getFileById(fileId.toString().trim()).setTrashed(true);
    return true;
  } catch (e) {
    return false; // fail dah tiada / tiada akses — abaikan sahaja
  }
}

/* =========================================================
   EMEL
   ========================================================= */

function sendClientEmail(to, clientName, folderName, finalPdfLink) {
  if (!isValidEmail(to)) return false;
  try {
    MailApp.sendEmail(
      to.trim(),
      "Laporan Kerja Disahkan - " + folderName,
      "Salam sejahtera " + clientName + ",\n\n" +
      "Terima kasih atas pengesahan anda. Status laporan kerja anda kini adalah APPROVED.\n\n" +
      "Berikut merupakan PDF GWR anda (Final PDF):\n" + finalPdfLink + "\n\n" +
      "Terima kasih,\nVoltake TEAM"
    );
    return true;
  } catch (err) {
    console.error("Gagal menghantar email klien: " + err);
    return false;
  }
}

/** Selepas klien sign — hantar pautan Final PDF kepada staff yang isi borang. */
function sendStaffEmail(row, info) {
  const to = String(row['StaffEmail'] || '').trim();
  if (!isValidEmail(to)) return false;

  const shutdown = row['JobShutdown'] || '-';
  const ptw = row['PTW'] || '-';
  const subject = '[GWR ' + DEPT + '] Disahkan Klien - ' +
    (row['PONumber'] || row['ReportID']) + (row['ClientCompany'] ? ' - ' + row['ClientCompany'] : '');

  const body =
    'Salam ' + (row['StaffName'] || '') + ',\n\n' +
    'Laporan GWR yang anda isi telah disahkan (APPROVED) oleh klien.\n\n' +
    'Report ID    : ' + row['ReportID'] + '\n' +
    'Tarikh Kerja : ' + fmtDate(row['Date']) + '\n' +
    'No. PO       : ' + (row['PONumber'] || '-') + '\n' +
    'Klien        : ' + (row['ClientCompany'] || '-') + '\n' +
    'Projek       : ' + (row['ProjectTitle'] || '-') + '\n' +
    'Lokasi       : ' + (row['Location'] || '-') + '\n' +
    'Job Shutdown : ' + shutdown + '\n' +
    'PTW          : ' + ptw + '\n\n' +
    'Disahkan oleh: ' + info.clientName + (info.clientPosition ? ' (' + info.clientPosition + ')' : '') + '\n' +
    'Masa disahkan: ' + info.approvedAt + '\n\n' +
    'Final PDF (Google Drive):\n' + info.finalPdfLink + '\n\n' +
    '— Emel automatik dari sistem GWR Voltake ' + DEPT;

  try {
    MailApp.sendEmail(to, subject, body, { name: 'Voltake GWR ' + DEPT });
    return true;
  } catch (err) {
    console.error("Gagal menghantar email staff: " + err);
    return false;
  }
}

/* =========================================================
   doGet — HALAMAN KELULUSAN KLIEN
   ========================================================= */

function doGet(e) {
  const token = (e && e.parameter) ? e.parameter.token : '';
  if (!token) {
    return HtmlService.createHtmlOutput(
      '<h1>Akses Ditolak</h1><p>Sila pastikan anda menggunakan pautan yang betul.</p>');
  }

  const ctx = openContext();
  const rowIndex = findRow(ctx, 'ApprovalToken', token);
  if (rowIndex === -1) return HtmlService.createHtmlOutput('<h1>Pautan Tidak Sah</h1>');

  const row = readRow(ctx, rowIndex);

  if (row['Status'] === 'Approved') {
    return HtmlService.createHtmlOutput(
      '<h1>Laporan Selesai</h1><p>Laporan ini telah disahkan sepenuhnya.</p>');
  }

  const template = HtmlService.createTemplateFromFile('Approval');
  template.reportData = {};
  HEADERS.forEach(function (h) {
    template.reportData[h] = (row[h] === undefined || row[h] === null) ? '' : row[h];
  });
  template.reportData.Date = fmtDate(row['Date']);

  // base64 PDF TIDAK dimasukkan ke dalam page — page load dalam 1-2 saat.
  // PDF ditarik melalui action "get_draft_pdf" hanya bila klien tekan Sahkan.
  template.scriptUrl = ScriptApp.getService().getUrl();

  return template.evaluate()
    .setTitle('Client Approval')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* =========================================================
   doPost — SEMUA TINDAKAN
   ========================================================= */

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // Upload gambar tidak sentuh sheet — tak perlu buka spreadsheet
    if (action === 'upload_images') return jsonOut(actionUploadImages(payload));

    const ctx = openContext();
    switch (action) {
      case 'save_draft':         return jsonOut(actionSaveDraft(ctx, payload));
      case 'search_po':          return jsonOut(actionSearchPo(ctx, payload));
      case 'submit_report':      return jsonOut(actionSubmitReport(ctx, payload));
      case 'get_draft_pdf':      return jsonOut(actionGetDraftPdf(ctx, payload));
      case 'client_approve':     return jsonOut(actionClientApprove(ctx, payload));
      case 'delete_report':      return jsonOut(actionDeleteReport(ctx, payload));
      case 'get_report_summary': return jsonOut(actionReportSummary(ctx, payload));
    }
    throw new Error("Tindakan tidak dikenali: " + action);

  } catch (error) {
    return jsonOut({ status: 'error', message: error.toString() });
  }
}

/* ---------------------------------------------------
   TINDAKAN 0: UPLOAD GAMBAR BERPERINGKAT
   Frontend hantar 3 gambar setiap kali, bukan semua sekaligus.
   --------------------------------------------------- */
function actionUploadImages(payload) {
  const folderName = buildFolderName(payload.location, payload.clientCompany, payload.date);
  return { status: 'success', images: saveImages(payload.images, folderName) };
}

/* ---------------------------------------------------
   TINDAKAN A: SIMPAN DRAF
   --------------------------------------------------- */
function actionSaveDraft(ctx, payload) {
  const dup = findDuplicateResponse(ctx, payload.clientReqId);
  if (dup) return dup;

  // Kerja Drive di luar kunci — ia perlahan dan tidak sentuh sheet
  const folderName = buildFolderName(payload.location, payload.clientCompany, payload.date);
  const savedImages = saveImages(payload.draftImages, folderName);

  return withLock(function () {
    // Semak sekali lagi — request yang sama mungkin masuk serentak
    const dup2 = findDuplicateResponse(ctx, payload.clientReqId);
    if (dup2) return dup2;

    const staffToken = payload.staffToken || Utilities.getUuid();
    let rowIndex = payload.staffToken ? findRow(ctx, 'StaffToken', payload.staffToken) : -1;
    let reportId = '';

    if (rowIndex === -1) {
      reportId = newReportId(ctx);
      rowIndex = appendNewRow(ctx, reportId);
    } else {
      const existing = readRow(ctx, rowIndex);
      assertNotApproved(existing);
      reportId = existing['ReportID'] || ('REP-' + new Date().getTime());
    }

    const values = {
      'ReportID': reportId,
      'Timestamp': new Date(),
      'StaffToken': staffToken,
      'Status': 'Draft',
      'Date': payload.date || '',
      'PONumber': payload.po || '',
      'QuotationNumber': payload.qt || '',
      'MOSNumber': payload.mos || '',
      'ClientCompany': payload.clientCompany || '',
      'ProjectTitle': payload.title || '',
      'Location': payload.location || '',
      'PICName': payload.picName || '',
      'PICPhone': payload.picPhone ? "'" + payload.picPhone : '',
      'ClientSignName': payload.signClientName || '',
      'ClientSignPosition': payload.signClientPos || '',
      'ClientSignPhone': payload.signClientPhone ? "'" + payload.signClientPhone : '',
      'TimeIn': payload.timeIn || '',
      'TimeOut': payload.timeOut || '',
      'JobDesc': payload.jobDesc || '',
      'UnresolvedIssue': payload.issue || '',
      'Manpower': payload.remarks || '',
      'StaffName': payload.staffName || '',
      'StaffPosition': payload.staffPosition || '',
      'DraftImageData': JSON.stringify(savedImages)
    };
    if (payload.clientReqId) values['ClientReqId'] = payload.clientReqId;
    Object.assign(values, newFieldValues(payload));

    writeRow(ctx, rowIndex, values);

    return {
      status: 'success',
      message: 'Draf disimpan.',
      staffToken: staffToken,
      reportId: reportId,
      images: savedImages
    };
  });
}

/* ---------------------------------------------------
   TINDAKAN B: CARI DATA DRAF / PENDING
   --------------------------------------------------- */
function actionSearchPo(ctx, payload) {
  const sheet = ctx.sheet;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("Tiada draf atau rekod pending dijumpai.");

  // Hanya scan baris terkini (rekod lama tidak relevan untuk draf)
  const startRow = Math.max(2, lastRow - SEARCH_SCAN_LIMIT + 1);
  const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, ctx.width).getValues();
  const searchPO = payload.po ? payload.po.toString().toUpperCase().trim() : "";

  const results = [];
  for (let i = data.length - 1; i >= 0; i--) { // terbaru dahulu
    const r = rowToObject(ctx, data[i]);
    const status = r['Status'];
    if (status !== 'Draft' && status !== 'Pending') continue;

    const currentPO = (r['PONumber'] || '').toString().toUpperCase();
    if (searchPO !== "" && currentPO.indexOf(searchPO) === -1) continue;

    results.push({
      date: r['Date'],
      po: r['PONumber'],
      client: r['ClientCompany'],
      qt: r['QuotationNumber'],
      mos: r['MOSNumber'],
      title: r['ProjectTitle'],
      loc: r['Location'],
      picName: r['PICName'],
      picPhone: (r['PICPhone'] || '').toString().replace(/^'/, ''),
      signClientName: r['ClientSignName'],
      signClientPos: r['ClientSignPosition'],
      signClientPhone: (r['ClientSignPhone'] || '').toString().replace(/^'/, ''),
      jobDesc: r['JobDesc'],
      timeIn: r['TimeIn'],
      timeOut: r['TimeOut'],
      issue: r['UnresolvedIssue'],
      remarks: r['Manpower'],
      staffName: r['StaffName'],
      staffPos: r['StaffPosition'],
      staffEmail: r['StaffEmail'] || '',
      staffToken: r['StaffToken'],
      draftImages: parseJsonArray(r['DraftImageData']),
      jobShutdown: r['JobShutdown'] || '',
      ptw: r['PTW'] || '',
      status: status,
      approvalToken: r['ApprovalToken']
    });
  }

  if (results.length === 0) throw new Error("Tiada draf atau rekod pending dijumpai.");
  return { status: 'success', data: results };
}

/* ---------------------------------------------------
   TINDAKAN C: SUBMIT REPORT
   --------------------------------------------------- */
function actionSubmitReport(ctx, payload) {
  const dup = findDuplicateResponse(ctx, payload.clientReqId);
  if (dup) return dup;

  // Kerja Drive di luar kunci
  const folderName = buildFolderName(payload.location, payload.clientCompany, payload.date);
  const staffSignId = saveFileToDrive(payload.staffSignatureBase64, folderName + '_StaffSign.png', folderName);
  const draftPdfId  = saveFileToDrive(payload.draftPdfBase64, folderName + '_Draft.pdf', folderName);
  const discardFiles = function () { trashFileSafe(staffSignId); trashFileSafe(draftPdfId); };

  return withLock(function () {
    const dup2 = findDuplicateResponse(ctx, payload.clientReqId);
    if (dup2) { discardFiles(); return dup2; }

    let rowIndex = payload.staffToken ? findRow(ctx, 'StaffToken', payload.staffToken) : -1;
    let reportId = '';

    if (rowIndex === -1) {
      reportId = newReportId(ctx);
      rowIndex = appendNewRow(ctx, reportId);
    } else {
      const existing = readRow(ctx, rowIndex);
      if (existing['Status'] === 'Approved') discardFiles();
      assertNotApproved(existing);
      reportId = existing['ReportID'] || ('REP-' + new Date().getTime());
    }

    const approvalToken = Utilities.getUuid();
    const values = {
      'ReportID': reportId,
      'Timestamp': new Date(),
      'StaffToken': payload.staffToken || Utilities.getUuid(),
      'Date': payload.date || '',
      'PONumber': payload.po || '',
      'QuotationNumber': payload.qt || '',
      'MOSNumber': payload.mos || '',
      'ClientCompany': payload.clientCompany || '',
      'ProjectTitle': payload.title || '',
      'Location': payload.location || '',
      'TimeIn': payload.timeIn || '',
      'TimeOut': payload.timeOut || '',
      'PICName': payload.picName || '',
      'PICPhone': payload.picPhone ? "'" + payload.picPhone : '',
      'ClientSignName': payload.signClientName || '',
      'ClientSignPosition': payload.signClientPos || '',
      'ClientSignPhone': payload.signClientPhone ? "'" + payload.signClientPhone : '',
      'JobDesc': payload.jobDesc || '',
      'UnresolvedIssue': payload.issue || '',
      'Manpower': payload.remarks || '',
      'StaffName': payload.staffName || '',
      'StaffPosition': payload.staffPosition || '',
      'StaffSignatureId': staffSignId || '',
      'DraftPdfId': draftPdfId || '',
      'ApprovalToken': approvalToken,
      'Status': 'Pending',
      'ClientReqId': payload.clientReqId || ''
    };

    // Kekalkan rujukan gambar jika dihantar
    if (payload.draftImages && payload.draftImages.length > 0) {
      const imgs = payload.draftImages
        .filter(function (im) { return im && im.id; })
        .map(function (im) { return { id: im.id, desc: im.desc || '' }; });
      if (imgs.length > 0) values['DraftImageData'] = JSON.stringify(imgs);
    }
    Object.assign(values, newFieldValues(payload));

    writeRow(ctx, rowIndex, values);

    return {
      status: 'success',
      message: 'Laporan sedia disahkan klien.',
      approvalLink: ScriptApp.getService().getUrl() + '?token=' + approvalToken,
      reportId: reportId
    };
  });
}

/* ---------------------------------------------------
   TINDAKAN C2: AMBIL DRAFT PDF
   Dipanggil oleh Approval.html hanya bila klien tekan Sahkan.
   --------------------------------------------------- */
function actionGetDraftPdf(ctx, payload) {
  const rowIndex = findRow(ctx, 'ApprovalToken', payload.token);
  if (rowIndex === -1) throw new Error("Token tidak sah.");

  const draftId = readRow(ctx, rowIndex)['DraftPdfId'];
  if (!draftId) throw new Error("Draft PDF tidak dijumpai untuk laporan ini.");

  const bytes = DriveApp.getFileById(draftId.toString().trim()).getBlob().getBytes();
  return { status: 'success', pdf: Utilities.base64Encode(bytes) };
}

/* ---------------------------------------------------
   TINDAKAN D: KLIEN LULUSKAN REPORT
   --------------------------------------------------- */
function alreadyApprovedResponse(row) {
  return {
    status: 'success',
    duplicate: true,
    message: 'Laporan ini telah pun diluluskan sebelum ini.',
    finalPdfLink: row['FinalPdfId'] ? ('https://drive.google.com/file/d/' + row['FinalPdfId'] + '/view') : ''
  };
}

function actionClientApprove(ctx, payload) {
  const dup = findDuplicateResponse(ctx, payload.clientReqId);
  if (dup) return dup;

  const rowIndex = findRow(ctx, 'ApprovalToken', payload.token);
  if (rowIndex === -1) throw new Error("Token klien tidak sah.");

  // Sudah diluluskan — pulangkan pautan sedia ada, jangan ulang proses.
  // Ini melindungi kes klien tekan Sahkan dua kali atau queue cuba semula.
  const before = readRow(ctx, rowIndex);
  if (before['Status'] === 'Approved') return alreadyApprovedResponse(before);

  // Kerja Drive di luar kunci
  const folderName = buildFolderName(before['Location'], before['ClientCompany'], before['Date']);
  const clientSignId = saveFileToDrive(payload.clientSignatureBase64, folderName + '_ClientSign.png', folderName);
  const finalPdfId   = saveFileToDrive(payload.finalPdfBase64, folderName + '_Final.pdf', folderName);
  const discardFiles = function () { trashFileSafe(clientSignId); trashFileSafe(finalPdfId); };

  if (!finalPdfId) {
    discardFiles();
    throw new Error('Final PDF tidak diterima oleh server. Sila cuba lagi.');
  }

  const result = withLock(function () {
    // Baris mungkin beralih (cth. laporan lain dipadam) — cari semula dalam kunci
    const idx = findRow(ctx, 'ApprovalToken', payload.token);
    if (idx === -1) { discardFiles(); throw new Error("Token klien tidak sah."); }

    const row = readRow(ctx, idx);
    if (row['Status'] === 'Approved') { discardFiles(); return { done: alreadyApprovedResponse(row) }; }

    writeRow(ctx, idx, {
      'Status': 'Approved',
      'ClientSignName': payload.clientName || '',
      'ClientSignPosition': payload.clientPosition || '',
      'ClientSignatureId': clientSignId || '',
      'FinalPdfId': finalPdfId,
      'ClientEmail': (payload.clientEmail || '').toString().trim(),
      'ClientPhone': payload.clientPhone ? "'" + payload.clientPhone : '',
      'ClientReqId': payload.clientReqId || ''
    });
    return { row: row };
  });
  if (result.done) return result.done;

  // Emel dihantar selepas kunci dilepaskan — MailApp boleh ambil beberapa saat
  const finalPdfLink = 'https://drive.google.com/file/d/' + finalPdfId + '/view';
  const clientEmailSent = sendClientEmail(payload.clientEmail, payload.clientName || '', folderName, finalPdfLink);
  const staffEmailSent = sendStaffEmail(result.row, {
    clientName: payload.clientName || '',
    clientPosition: payload.clientPosition || '',
    approvedAt: Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy hh:mm a'),
    finalPdfLink: finalPdfLink
  });

  return {
    status: 'success',
    message: 'Laporan telah diluluskan sepenuhnya.',
    finalPdfLink: finalPdfLink,
    clientEmailSent: clientEmailSent,
    staffEmailSent: staffEmailSent
  };
}

/* ---------------------------------------------------
   TINDAKAN E: DELETE REPORT (perlu PIN admin)
   --------------------------------------------------- */

/**
 * Dulu sesiapa yang tahu URL web app boleh padam laporan — perkataan "PADAM"
 * hanya disemak dalam browser. Sekarang server sahkan PIN yang disimpan dalam
 * Script Properties (tidak kelihatan dalam kod frontend).
 */
function checkDeletePin(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty(DELETE_PIN_PROP);
  if (!expected) {
    throw new Error('PIN padam belum ditetapkan. Tetapkan ' + DELETE_PIN_PROP +
      ' dalam Project Settings > Script Properties dahulu.');
  }

  const cache = CacheService.getScriptCache();
  const fails = parseInt(cache.get('delete_pin_fails') || '0', 10);
  if (fails >= DELETE_MAX_FAILS) {
    throw new Error('Terlalu banyak cubaan PIN salah. Sila cuba lagi selepas 10 minit.');
  }

  if (String(pin || '') !== String(expected)) {
    cache.put('delete_pin_fails', String(fails + 1), DELETE_LOCKOUT_SEC);
    throw new Error('PIN admin salah.');
  }
  cache.remove('delete_pin_fails');
}

function actionDeleteReport(ctx, payload) {
  checkDeletePin(payload.adminPin);

  const removed = withLock(function () {
    const idx = findRow(ctx, 'ReportID', payload.reportId);
    if (idx === -1) throw new Error("Laporan tidak dijumpai dalam pangkalan data.");
    const row = readRow(ctx, idx);
    ctx.sheet.deleteRow(idx);
    return row;
  });

  // Buang fail Drive selepas kunci dilepaskan
  let filesTrashed = 0;
  if (payload.deleteFiles === true) {
    ['StaffSignatureId', 'DraftPdfId', 'ClientSignatureId', 'FinalPdfId'].forEach(function (h) {
      if (trashFileSafe(removed[h])) filesTrashed++;
    });
    parseJsonArray(removed['DraftImageData']).forEach(function (im) {
      if (im && trashFileSafe(im.id)) filesTrashed++;
    });
  }

  return {
    status: 'success',
    message: 'Laporan berjaya dipadam dari rekod.',
    filesTrashed: filesTrashed
  };
}

/* ---------------------------------------------------
   TINDAKAN F: RINGKASAN LAPORAN (untuk popup delete)
   --------------------------------------------------- */
function actionReportSummary(ctx, payload) {
  const rowIndex = findRow(ctx, 'ReportID', payload.reportId);
  if (rowIndex === -1) throw new Error("Laporan tidak dijumpai.");

  const row = readRow(ctx, rowIndex);
  const imgCount = parseJsonArray(row['DraftImageData']).length;

  let fileCount = imgCount;
  ['StaffSignatureId', 'DraftPdfId', 'ClientSignatureId', 'FinalPdfId'].forEach(function (h) {
    if (row[h]) fileCount++;
  });

  return {
    status: 'success',
    data: {
      reportId: row['ReportID'],
      date: row['Date'],
      po: row['PONumber'],
      client: row['ClientCompany'],
      title: row['ProjectTitle'],
      status: row['Status'],
      imageCount: imgCount,
      fileCount: fileCount
    }
  };
}

/* =========================================================
   KEMAS LAJUR — jalankan SEKALI dari editor
   =========================================================
   v4.0 tersilap cipta lajur baru (Remarks, DraftImagesData, JobItemsData,
   ManpowerData) kerana nama header dalam sheet berbeza. Lajur Add Attach (PDF),
   Submission Inv dan Status Inv pula tidak terpakai. Fungsi ini:
   1. Buat salinan backup sheet dahulu (Reports_backup_<tarikh>).
   2. Pindah data Remarks -> Manpower dan DraftImagesData -> DraftImageData
      (hanya untuk baris yang lajur asalnya kosong).
   3. Padam semua lajur dalam REMOVED_COLUMNS.
   4. Tambah lajur yang masih tiada (cth PTW) di hujung.
   Selamat dijalankan lebih dari sekali — kalau tiada pendua, ia tidak buat apa-apa.
   ========================================================= */
function cleanupDuplicateColumns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet ' + SHEET_NAME + ' tidak dijumpai.');

  withLock(function () {
    const header = readHeader(sheet);
    const toDelete = REMOVED_COLUMNS.filter(function (h) {
      if (header.indexOf(h) === -1) return false;
      // Remarks / DraftImagesData hanya dipadam kalau lajur asal memang wujud
      const target = Object.keys(HEADER_ALIASES).filter(function (n) {
        return HEADER_ALIASES[n].indexOf(h) > -1;
      })[0];
      return !target || header.indexOf(target) > -1;
    });

    if (!toDelete.length) {
      console.log('Tiada lajur untuk dibuang. Tiada apa diubah.');
      return;
    }

    const stamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd_HHmm');
    sheet.copyTo(ss).setName(SHEET_NAME + '_backup_' + stamp);
    console.log('Backup dicipta: ' + SHEET_NAME + '_backup_' + stamp);

    const lastRow = sheet.getLastRow();
    Object.keys(HEADER_ALIASES).forEach(function (target) {
      const tCol = header.indexOf(target) + 1;
      HEADER_ALIASES[target].forEach(function (dup) {
        const dCol = header.indexOf(dup) + 1;
        if (!tCol || !dCol || lastRow < 2 || toDelete.indexOf(dup) === -1) return;
        const tRange = sheet.getRange(2, tCol, lastRow - 1, 1);
        const tVals = tRange.getValues();
        const dVals = sheet.getRange(2, dCol, lastRow - 1, 1).getValues();
        let moved = 0;
        for (let i = 0; i < tVals.length; i++) {
          if ((tVals[i][0] === '' || tVals[i][0] === null) && dVals[i][0] !== '') {
            tVals[i][0] = dVals[i][0];
            moved++;
          }
        }
        if (moved) tRange.setValues(tVals);
        console.log(dup + ' -> ' + target + ': ' + moved + ' baris dipindah.');
      });
    });

    // Rekod berapa sel berisi data dalam lajur yang akan dipadam (salinan ada dalam backup)
    toDelete.forEach(function (h) {
      if (lastRow < 2) return;
      const vals = sheet.getRange(2, header.indexOf(h) + 1, lastRow - 1, 1).getValues();
      const filled = vals.filter(function (v) { return v[0] !== '' && v[0] !== null; }).length;
      if (filled) console.log('Lajur "' + h + '" ada ' + filled + ' sel berisi — salinan ada dalam backup.');
    });

    // Padam dari kanan ke kiri supaya nombor lajur tidak beralih
    toDelete
      .map(function (h) { return header.indexOf(h) + 1; })
      .sort(function (a, b) { return b - a; })
      .forEach(function (col) { sheet.deleteColumn(col); });
    console.log('Lajur dipadam: ' + toDelete.join(', '));
  });

  // Tambah lajur yang masih tiada (cth PTW) di hujung
  const ctx = openContext();
  console.log('Header akhir: ' + readHeader(ctx.sheet).join(' | '));
}

/* =========================================================
   SEMAKAN TETAPAN — jalankan sekali dari editor selepas paste kod
   ========================================================= */
function checkSetup() {
  const ctx = openContext();
  console.log('Sheet: ' + ctx.sheet.getName() + ' — ' + ctx.width + ' lajur');

  const header = readHeader(ctx.sheet);
  const dups = REMOVED_COLUMNS.filter(function (h) { return header.indexOf(h) > -1; });
  console.log(dups.length
    ? ('Lajur untuk dibuang masih ada: ' + dups.join(', ') + ' — jalankan cleanupDuplicateColumns().')
    : 'Tiada lajur pendua / tidak terpakai.');

  const pin = PropertiesService.getScriptProperties().getProperty(DELETE_PIN_PROP);
  console.log(pin ? 'DELETE_PIN: sudah ditetapkan.' :
    'DELETE_PIN: BELUM ditetapkan — padam laporan dari dashboard akan ditolak.');

  console.log('Baki kuota emel hari ini: ' + MailApp.getRemainingDailyQuota());
  DriveApp.getFolderById(ROOT_DRIVE_ID); // pastikan akses folder Drive
  console.log('Akses folder Drive OK.');
}
