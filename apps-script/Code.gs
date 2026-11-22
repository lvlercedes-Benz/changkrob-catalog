/**
 * ช่างครบ Changkrob แค็ตตาล็อกสินค้า — ฐานข้อมูลบน Google Sheets
 *
 * วิธีติดตั้ง (ทำครั้งเดียว):
 *  1. สร้าง Google Sheet ใหม่ → ส่วนขยาย → Apps Script → ลบโค้ดเดิม แล้ววางโค้ดนี้ทั้งหมด → บันทึก
 *  2. เลือกฟังก์ชัน setup ด้านบน แล้วกด "เรียกใช้" (Run) → อนุญาตสิทธิ์ (Sheets + Drive)
 *  3. ทำให้ใช้งานได้ (Deploy) → การทำให้ใช้งานได้รายการใหม่ → ประเภท: เว็บแอป
 *       เรียกใช้ในฐานะ: ฉัน (Me) · ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน (Anyone) → Deploy
 *  4. คัดลอกลิงก์ที่ลงท้ายด้วย /exec ไปใส่ใน index.html บรรทัด const API_URL = '';
 *
 * เมื่อแก้โค้ดนี้ภายหลัง ต้อง Deploy → Manage deployments → ✏️ → Version: New version → Deploy
 * รหัสพนักงานจัดการได้ในชีต Staff โดยไม่ต้อง Deploy ใหม่
 */

const SHEET = {products: 'Products', staff: 'Staff', settings: 'Settings', log: 'Log'};
const IMAGE_FOLDER_NAME = 'ช่างครบ รูปสินค้า Shopee';

// [key ที่หน้าเว็บใช้, หัวคอลัมน์ในชีต, ชนิด, ชื่อหัวคอลัมน์เดิม]  — ย้ายลำดับคอลัมน์ในชีตได้ แต่ห้ามเปลี่ยนชื่อหัวคอลัมน์
// ชื่อเดิมในช่องที่ 4 จะถูกเปลี่ยนเป็นชื่อใหม่ให้อัตโนมัติ (ข้อมูลในคอลัมน์ไม่หาย)
const FIELDS = [
  ['id', 'ID', 't'], ['sku', 'รหัส SKU', 't'], ['name', 'ชื่อสินค้า', 't'], ['category', 'หมวดหมู่ร้าน', 't'],
  ['brand', 'ยี่ห้อ (Brand)', 't', ['ยี่ห้อ / รุ่น']], ['model', 'รุ่น', 't'], ['unit', 'หน่วยขาย', 't'], ['status', 'สถานะลงขาย', 't'],
  ['shopeeCat', 'หมวดหมู่ Shopee', 't'], ['description', 'รายละเอียดสินค้า', 't'],
  ['parentSku', 'Parent SKU', 't'], ['varName', 'ชื่อตัวเลือก', 't'], ['variant', 'ตัวเลือก / ขนาด', 't'],
  ['images', 'ลิงก์รูป (บรรทัดละรูป)', 't'], ['video', 'ลิงก์วิดีโอ', 't'], ['size', 'ขนาดสินค้า (ซม.)', 't'],
  ['boxType', 'ชนิดกล่อง', 't'], ['pkgL', 'กล่อง ยาว (ซม.)', 'n'], ['pkgW', 'กล่อง กว้าง (ซม.)', 'n'], ['pkgH', 'กล่อง สูง (ซม.)', 'n'],
  ['weight', 'น้ำหนักสินค้า (กก.)', 'n'], ['packedWeight', 'น้ำหนักหลังแพ็ก (กก.)', 'n'], ['dts', 'เวลาเตรียมจัดส่ง (วัน)', 'n'],
  ['cost', 'ราคาต้นทุน', 'n', ['ต้นทุนสินค้า']], ['storePrice', 'ราคาหน้าร้าน', 'n'], ['price', 'ราคา Shopee', 'n', ['ราคาขาย']], ['discount', 'ส่วนลดที่ร้านออก', 'n'],
  ['packing', 'ค่าบรรจุภัณฑ์', 'n'], ['other', 'ค่าใช้จ่ายอื่น', 'n'], ['feePct', 'ค่าธรรมเนียมรวม (%)', 'n'], ['fixedFee', 'ค่าธรรมเนียมคงที่ / หน่วย', 'n'],
  ['stock', 'คงเหลือจริง', 'n'], ['reserved', 'จองรอส่ง', 'n'], ['reorder', 'จุดสั่งซื้อเพิ่ม', 'n'],
  ['location', 'ตำแหน่งจัดเก็บ', 't'], ['supplier', 'ผู้จำหน่าย', 't'], ['lead', 'ระยะเวลาสั่งเข้า (วัน)', 'n'],
  ['shopeeUrl', 'ลิงก์สินค้า Shopee', 't'], ['notes', 'หมายเหตุ', 't'],
  ['createdAt', 'สร้างเมื่อ', 't'], ['updatedAt', 'แก้ไขล่าสุด', 't'], ['updatedBy', 'แก้ไขโดย', 't']
];
const SETTING_KEYS = {feePct: 'ค่าธรรมเนียมรวมเริ่มต้น (%)', fixedFee: 'ค่าธรรมเนียมคงที่ / หน่วย (บาท)', dts: 'เวลาเตรียมจัดส่งเริ่มต้น (วัน)'};

/* ---------------- entry points ---------------- */
function doGet() { return json_({ok: true, app: 'changkrob-catalog'}); }
function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ok: false, error: 'คำขอไม่ถูกต้อง'}); }
  return json_(handle_(req));
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function handle_(req) {
  try {
    const staff = auth_(req.pin);
    if (!staff) return {ok: false, code: 'pin', error: 'รหัสพนักงานไม่ถูกต้อง หรือถูกปิดการใช้งาน'};
    switch (req.action) {
      case 'list': return {ok: true, products: readProducts_().list, settings: publicSettings_(), me: staff.name};
      case 'save': return withLock_(() => ({ok: true, product: saveProduct_(req.product, staff)}));
      case 'delete': return withLock_(() => deleteProduct_(req.id, staff));
      case 'bulk': return withLock_(() => bulk_(req.products || [], staff));
      case 'settings': return withLock_(() => saveSettings_(req.settings || {}, staff));
      case 'upload': return {ok: true, url: upload_(req.name, req.data)};
      case 'videoStart': return videoStart_(req);
      case 'videoChunk': return videoChunk_(req);
      default: return {ok: false, error: 'ไม่รู้จักคำสั่ง: ' + req.action};
    }
  } catch (err) {
    return {ok: false, error: String(err && err.message || err)};
  }
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return {ok: false, error: 'มีคนกำลังบันทึกอยู่ ลองอีกครั้ง'};
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------------- staff (PIN) ---------------- */
function auth_(pin) {
  pin = String(pin == null ? '' : pin).trim();
  if (!pin) return null;
  const sh = ss_().getSheetByName(SHEET.staff);
  if (!sh || sh.getLastRow() < 2) return null;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getDisplayValues();
  for (const r of rows) {
    const name = String(r[0]).trim(), code = String(r[1]).trim(), status = String(r[2]).trim();
    if (code && code === pin) {
      if (/^(ปิด|ระงับ|ลาออก|off|no|false|inactive)$/i.test(status)) return null; // first matching row decides
      return {name: name || 'พนักงาน', code};
    }
  }
  return null;
}

/* ---------------- products ---------------- */
function productsSheet_() {
  const sh = ss_().getSheetByName(SHEET.products);
  if (!sh) throw new Error('ไม่พบชีต Products — เปิด Apps Script แล้วกด Run ฟังก์ชัน setup ก่อน');
  ensureColumns_(sh);
  return sh;
}
// Renames old headers and adds any missing ones (e.g. after an upgrade) without disturbing existing data.
function ensureColumns_(sh) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const head = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(h => String(h).trim());
  FIELDS.forEach(f => {
    if (head.indexOf(f[1]) >= 0 || head.indexOf(f[0]) >= 0 || !f[3]) return;
    const i = f[3].map(old => head.indexOf(old)).find(x => x >= 0);
    if (i != null) { sh.getRange(1, i + 1).setValue(f[1]); head[i] = f[1]; }
  });
  const missing = FIELDS.filter(f => head.indexOf(f[1]) < 0 && head.indexOf(f[0]) < 0);
  if (!missing.length) return;
  const start = head.filter(Boolean).length ? lastCol + 1 : 1;
  sh.getRange(1, start, 1, missing.length).setValues([missing.map(f => f[1])]);
  missing.forEach((f, i) => { if (f[2] === 't') sh.getRange(2, start + i, sh.getMaxRows() - 1, 1).setNumberFormat('@'); });
  if (missing.some(f => f[0] === 'model')) splitBrandModel_(sh, head.indexOf('ยี่ห้อ (Brand)'), start + missing.findIndex(f => f[0] === 'model') - 1);
}
// One-time move: old "ยี่ห้อ / รุ่น" values like "King Eagle / 08-16101" become brand "King Eagle" + model "08-16101".
function splitBrandModel_(sh, brandCol, modelCol) {
  const n = sh.getLastRow() - 1;
  if (brandCol < 0 || n < 1) return;
  const b = sh.getRange(2, brandCol + 1, n, 1).getValues(), m = sh.getRange(2, modelCol + 1, n, 1).getValues();
  let changed = false;
  b.forEach((r, i) => {
    const v = String(r[0] || ''), k = v.indexOf(' / ');
    if (k > 0 && !m[i][0]) { r[0] = v.slice(0, k).trim(); m[i][0] = v.slice(k + 3).trim(); changed = true; }
  });
  if (changed) { sh.getRange(2, brandCol + 1, n, 1).setValues(b); sh.getRange(2, modelCol + 1, n, 1).setValues(m); }
}
function colMap_(sh) {
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(h => String(h).trim());
  const map = {};
  FIELDS.forEach(f => {
    let i = head.indexOf(f[1]);
    if (i < 0) i = head.indexOf(f[0]);
    if (i < 0 && f[3]) i = f[3].map(old => head.indexOf(old)).find(x => x >= 0) ?? -1;
    if (i >= 0) map[f[0]] = i;
  });
  return {map, width: head.length};
}
function readProducts_() {
  const sh = productsSheet_();
  const {map, width} = colMap_(sh);
  const n = sh.getLastRow() - 1;
  const values = n > 0 ? sh.getRange(2, 1, n, width).getValues() : [];
  const list = [], rowOf = {};
  values.forEach((r, i) => {
    const p = {};
    FIELDS.forEach(([k, , type]) => {
      if (map[k] == null) return;
      let v = r[map[k]];
      if (v instanceof Date) v = v.toISOString();
      if (type === 'n') v = (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);
      else v = v == null ? '' : String(v);
      p[k] = v;
    });
    if (!p.id && !p.sku && !p.name) return; // blank row
    if (!p.id) { p.id = newId_(); sh.getRange(i + 2, map.id + 1).setValue(p.id); } // rows typed straight into the sheet
    p.images = String(p.images || '').split(/\s*[\n|]\s*/).filter(Boolean);
    list.push(p); rowOf[p.id] = i + 2;
  });
  return {list, rowOf, map, width, sh};
}
function clean_(raw) {
  const p = {};
  FIELDS.forEach(([k, , type]) => {
    let v = raw ? raw[k] : null;
    if (k === 'images') v = (Array.isArray(v) ? v : String(v || '').split(/\s*[\n|]\s*/))
      .map(s => String(s).trim()).filter(s => /^https?:\/\//.test(s)).slice(0, 9).join('\n');
    else if (k === 'video') v = /^https?:\/\//.test(String(v || '').trim()) ? String(v).trim() : '';
    else if (type === 'n') v = (v === '' || v == null || isNaN(Number(v))) ? '' : Number(v);
    else v = v == null ? '' : String(v).trim();
    p[k] = v;
  });
  return p;
}
function writeRow_(ctx, p, row) {
  const cur = row ? ctx.sh.getRange(row, 1, 1, ctx.width).getValues()[0] : new Array(ctx.width).fill('');
  FIELDS.forEach(([k]) => { if (ctx.map[k] != null) cur[ctx.map[k]] = p[k]; });
  const target = row || ctx.sh.getLastRow() + 1;
  ctx.sh.getRange(target, 1, 1, ctx.width).setValues([cur]);
  return target;
}
function toClient_(p) {
  const o = {};
  FIELDS.forEach(([k, , type]) => { o[k] = type === 'n' ? (p[k] === '' ? null : p[k]) : p[k]; });
  o.images = String(p.images || '').split('\n').filter(Boolean);
  return o;
}
function saveProduct_(raw, staff) {
  const p = clean_(raw);
  if (!p.name) throw new Error('กรุณาใส่ชื่อสินค้า');
  if (!p.sku) throw new Error('กรุณาใส่รหัส SKU');
  const ctx = readProducts_();
  const dup = ctx.list.find(o => o.sku.toLowerCase() === p.sku.toLowerCase() && o.id !== p.id);
  if (dup) throw new Error('รหัส SKU นี้มีอยู่แล้ว: ' + p.sku);
  const now = new Date().toISOString();
  const existing = p.id && ctx.rowOf[p.id];
  if (existing) p.createdAt = ctx.list.find(o => o.id === p.id).createdAt || now;
  else { p.id = p.id || newId_(); p.createdAt = now; }
  p.updatedAt = now; p.updatedBy = staff.name;
  writeRow_(ctx, p, existing || null);
  log_(staff, existing ? 'แก้ไข' : 'เพิ่ม', p.sku, p.name);
  return toClient_(p);
}
function deleteProduct_(id, staff) {
  const ctx = readProducts_();
  const row = ctx.rowOf[id];
  if (!row) return {ok: true}; // already gone
  const p = ctx.list.find(o => o.id === id);
  ctx.sh.deleteRow(row);
  log_(staff, 'ลบ', p.sku, p.name);
  return {ok: true};
}
function bulk_(list, staff) {
  const ctx = readProducts_();
  const bySku = {};
  ctx.list.forEach(o => bySku[o.sku.toLowerCase()] = o);
  const now = new Date().toISOString();
  let added = 0, updated = 0;
  const seen = {};
  list.forEach(raw => {
    const p = clean_(raw);
    if (!p.sku || seen[p.sku.toLowerCase()]) return;
    seen[p.sku.toLowerCase()] = 1;
    const cur = (p.id && ctx.list.find(o => o.id === p.id)) || bySku[p.sku.toLowerCase()];
    if (!cur && !p.name) return;
    p.updatedAt = now; p.updatedBy = staff.name;
    if (cur) { p.id = cur.id; p.createdAt = cur.createdAt || now; writeRow_(ctx, p, ctx.rowOf[cur.id]); updated++; }
    else { p.id = newId_(); p.createdAt = now; writeRow_(ctx, p, null); added++; }
  });
  log_(staff, 'นำเข้า Excel', '', 'เพิ่ม ' + added + ' · อัปเดต ' + updated);
  return {ok: true, added, updated};
}
function newId_() { return 'P' + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }

/* ---------------- settings ---------------- */
function settingsMap_() {
  const sh = ss_().getSheetByName(SHEET.settings);
  const out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => { if (r[0]) out[String(r[0]).trim()] = r[1]; });
  return out;
}
function publicSettings_() {
  const s = settingsMap_(), out = {};
  Object.keys(SETTING_KEYS).forEach(k => out[k] = (s[k] === '' || s[k] == null) ? null : Number(s[k]));
  return out;
}
function setSetting_(key, value, note) {
  const ss = ss_();
  const sh = ss.getSheetByName(SHEET.settings) || ss.insertSheet(SHEET.settings);
  if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, 3).setValues([['key', 'value', 'คำอธิบาย']]);
  const n = sh.getLastRow() - 1;
  const keys = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0]).trim()) : [];
  const i = keys.indexOf(key);
  if (i >= 0) sh.getRange(i + 2, 2).setValue(value);
  else sh.appendRow([key, value, note || '']);
}
function saveSettings_(s, staff) {
  Object.keys(SETTING_KEYS).forEach(k => {
    if (!(k in s)) return;
    const v = s[k] === '' || s[k] == null || isNaN(Number(s[k])) ? '' : Number(s[k]);
    setSetting_(k, v, SETTING_KEYS[k]);
  });
  log_(staff, 'ตั้งค่า', '', JSON.stringify(s));
  return {ok: true, settings: publicSettings_()};
}

/* ---------------- images (Google Drive) ---------------- */
function imageFolder_() {
  const id = settingsMap_().imageFolderId;
  if (id) { try { return DriveApp.getFolderById(String(id)); } catch (e) { /* deleted — make a new one */ } }
  const folder = DriveApp.createFolder(IMAGE_FOLDER_NAME);
  setSetting_('imageFolderId', folder.getId(), 'โฟลเดอร์ Google Drive ที่เก็บรูปสินค้า (ระบบสร้างให้)');
  return folder;
}
function upload_(name, dataUrl) {
  const m = String(dataUrl || '').match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!m) throw new Error('ไฟล์รูปไม่ถูกต้อง');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 10 * 1024 * 1024) throw new Error('รูปใหญ่เกิน 10 MB');
  const safe = String(name || 'image.jpg').replace(/[^\w.\-ก-๙]/g, '_').slice(0, 80);
  const file = imageFolder_().createFile(Utilities.newBlob(bytes, m[1], safe));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // Shopee and the web page need to load it
  return 'https://lh3.googleusercontent.com/d/' + file.getId();
}

/* ---------------- product video (Google Drive, uploaded in pieces) ----------------
   หน้าเว็บส่งวิดีโอเป็นชิ้นละ 4 MB แล้วสคริปต์ต่อเข้าไฟล์เดียวใน Drive ด้วย resumable upload
   ครั้งแรกหลังอัปเดตโค้ดนี้ ให้กด Run ฟังก์ชัน authorize หนึ่งครั้งเพื่ออนุญาตสิทธิ์เพิ่ม */
const VIDEO_MAX = 30 * 1024 * 1024;      // Shopee รับวิดีโอสินค้าไม่เกิน 30 MB
const VIDEO_CHUNK = 4 * 1024 * 1024;     // ต้องหารด้วย 256 KB ลงตัว (ข้อกำหนดของ Drive)
function videoStart_(req) {
  const size = Number(req.size), mime = String(req.mime || '').toLowerCase();
  if (!(size > 0)) throw new Error('ไฟล์วิดีโอว่าง');
  if (size > VIDEO_MAX) throw new Error('วิดีโอใหญ่เกิน 30 MB');
  if (!/^video\/(mp4|quicktime)$/.test(mime)) throw new Error('รองรับเฉพาะไฟล์ MP4 หรือ MOV');
  const name = String(req.name || 'video.mp4').replace(/[^\w.\-ก-๙]/g, '_').slice(0, 80);
  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
    method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size)},
    payload: JSON.stringify({name, mimeType: mime, parents: [imageFolder_().getId()]})
  });
  const h = res.getHeaders(), loc = h.Location || h.location;
  if (res.getResponseCode() !== 200 || !loc) throw new Error('เริ่มอัปโหลดวิดีโอไม่ได้ (' + res.getResponseCode() + ')');
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('vid:' + token, JSON.stringify({loc, size, mime}), 21600);
  return {ok: true, token, chunk: VIDEO_CHUNK};
}
function videoChunk_(req) {
  const cache = CacheService.getScriptCache(), key = 'vid:' + String(req.token || '');
  const raw = cache.get(key);
  if (!raw) throw new Error('หมดเวลาอัปโหลด กรุณาเลือกวิดีโอใหม่อีกครั้ง');
  const s = JSON.parse(raw);
  const bytes = Utilities.base64Decode(String(req.data || ''));
  const start = Number(req.start), end = start + bytes.length - 1;
  if (!(start >= 0) || !bytes.length || end >= s.size) throw new Error('ข้อมูลวิดีโอไม่ตรงกัน กรุณาลองใหม่');
  const res = UrlFetchApp.fetch(s.loc, {
    method: 'put', contentType: s.mime, payload: bytes, muteHttpExceptions: true, followRedirects: false,
    headers: {'Content-Range': 'bytes ' + start + '-' + end + '/' + s.size}
  });
  const code = res.getResponseCode();
  if (code === 308) return {ok: true, done: false, received: end + 1};
  if (code === 200 || code === 201) {
    const id = JSON.parse(res.getContentText()).id;
    DriveApp.getFileById(id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    cache.remove(key);
    return {ok: true, done: true, url: 'https://drive.google.com/file/d/' + id + '/view'};
  }
  throw new Error('อัปโหลดวิดีโอไม่สำเร็จ (' + code + ')');
}
// กด Run ฟังก์ชันนี้หนึ่งครั้งหลังอัปเดตโค้ด เพื่อให้ Google ขอสิทธิ์ส่งไฟล์วิดีโอเข้า Drive
function authorize() {
  UrlFetchApp.getRequest('https://www.googleapis.com/drive/v3/about');
  Logger.log('โฟลเดอร์รูปและวิดีโอ: ' + imageFolder_().getUrl());
  Logger.log('อนุญาตสิทธิ์เรียบร้อย ต่อไปให้ Deploy > Manage deployments > New version');
}

/* ---------------- log ---------------- */
function log_(staff, action, sku, detail) {
  const ss = ss_();
  const sh = ss.getSheetByName(SHEET.log) || ss.insertSheet(SHEET.log);
  if (sh.getLastRow() < 1) sh.appendRow(['เวลา', 'ผู้ใช้', 'รหัสพนักงาน', 'การทำรายการ', 'SKU', 'รายละเอียด']);
  sh.appendRow([new Date(), staff.name, "'" + staff.code, action, sku, String(detail || '').slice(0, 500)]);
}

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

/* ---------------- one-time setup (กด Run ฟังก์ชันนี้) ---------------- */
function setup() {
  const ss = ss_();
  let p = ss.getSheetByName(SHEET.products);
  if (!p) {
    p = ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0 ? ss.getSheets()[0].setName(SHEET.products) : ss.insertSheet(SHEET.products);
  }
  if (p.getLastRow() === 0) {
    p.getRange(1, 1, 1, FIELDS.length).setValues([FIELDS.map(f => f[1])]);
    FIELDS.forEach((f, i) => { if (f[2] === 't') p.getRange(2, i + 1, p.getMaxRows() - 1, 1).setNumberFormat('@'); });
  }
  ensureColumns_(p);
  p.setFrozenRows(1);
  p.getRange(1, 1, 1, p.getLastColumn()).setFontWeight('bold').setBackground('#011E49').setFontColor('#FFFFFF');

  let s = ss.getSheetByName(SHEET.staff);
  if (!s) {
    s = ss.insertSheet(SHEET.staff);
    s.getRange('B:B').setNumberFormat('@'); // keep leading zeros in codes
    s.getRange(1, 1, 2, 3).setValues([['ชื่อพนักงาน', 'รหัส', 'สถานะ'], ['เจ้าของร้าน', '1234', 'ใช้งาน']]);
    s.getRange(1, 1, 1, 3).setFontWeight('bold');
    s.setFrozenRows(1);
  }

  Object.keys(SETTING_KEYS).forEach(k => { if (!(k in settingsMap_())) setSetting_(k, '', SETTING_KEYS[k]); });
  const folder = imageFolder_(); // also asks for Drive permission now rather than on the first upload
  if (!ss.getSheetByName(SHEET.log)) log_({name: 'ระบบ', code: '-'}, 'ติดตั้ง', '', 'สร้างชีตและโฟลเดอร์รูป');

  Logger.log('ติดตั้งเสร็จแล้ว · โฟลเดอร์รูป: ' + folder.getUrl());
  Logger.log('รหัสเริ่มต้นคือ 1234 — เปลี่ยนในชีต Staff ก่อนใช้งานจริง');
}
