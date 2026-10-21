const $ = (selector) => document.querySelector(selector);
const state = { db: null, notes: [], activeId: null, images: [], imageUrls: [], saveTimer: null, pendingImports: new Map(), importBusy: false };
const DB_NAME = 'laonote-v1';
const STORE_NOTES = 'notes';
const STORE_IMAGES = 'images';

function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function formatDate(value) { return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function fileName(title, ext) { return `${(title || 'โน้ต').replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').slice(0, 70)}.${ext}`; }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3000); }
function setSaveStatus(message) { $('#saveStatus').textContent = message; }
function setUploadStatus(message, kind = 'working') {
  $('#uploadStatus').textContent = message;
  $('#uploadStatus').dataset.kind = kind;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NOTES)) db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_IMAGES)) db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function dbAction(store, mode, callback) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(store, mode);
    const request = callback(tx.objectStore(store));
    let result;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}
const getAllNotes = () => dbAction(STORE_NOTES, 'readonly', s => s.getAll());
const putNote = note => dbAction(STORE_NOTES, 'readwrite', s => s.put(note));
const deleteNoteDb = id => dbAction(STORE_NOTES, 'readwrite', s => s.delete(id));
const getImage = id => dbAction(STORE_IMAGES, 'readonly', s => s.get(id));
const putImage = image => dbAction(STORE_IMAGES, 'readwrite', s => s.put(image));
const deleteImageDb = id => dbAction(STORE_IMAGES, 'readwrite', s => s.delete(id));
const activeNote = () => state.notes.find(note => note.id === state.activeId);

function newBlankNote() { return { id: uid(), title: '', body: '', summary: '', imageIds: [], created: Date.now(), updated: Date.now() }; }
async function createNote() {
  await flushSave();
  const note = newBlankNote();
  await putNote(note);
  state.notes.unshift(note);
  selectNote(note.id);
  $('#titleInput').focus();
  $('#sidebar').classList.remove('open');
}
function renderList() {
  const term = $('#searchInput').value.trim().toLocaleLowerCase();
  const filtered = [...state.notes].sort((a, b) => b.updated - a.updated).filter(note => `${note.title} ${note.body} ${note.summary}`.toLocaleLowerCase().includes(term));
  $('#noteCount').textContent = state.notes.length;
  $('#noteList').innerHTML = filtered.length ? filtered.map(note => `<div class="note-item ${note.id === state.activeId ? 'active' : ''}" role="listitem" data-id="${escapeHtml(note.id)}" tabindex="0"><strong>${escapeHtml(note.title || 'โน้ตไม่มีชื่อ')}</strong><span class="excerpt">${escapeHtml(note.body.trim().replace(/\s+/g, ' ').slice(0, 95) || 'เริ่มเขียนเนื้อหา...')}</span><span class="date">${formatDate(note.updated)}</span></div>`).join('') : '<div class="note-list-empty">ยังไม่พบโน้ต</div>';
}
async function selectNote(id) {
  if (state.activeId !== id) await flushSave();
  const note = state.notes.find(item => item.id === id);
  if (!note) return;
  state.activeId = id;
  $('#titleInput').value = note.title;
  $('#bodyInput').value = note.body;
  $('#summaryInput').value = note.summary;
  $('#summaryInput').hidden = false;
  $('#breadcrumbTitle').textContent = note.title || 'โน้ตใหม่';
  $('#dateLabel').textContent = formatDate(note.created);
  $('#summaryMethod').textContent = note.summary ? 'บันทึกแล้ว · แก้ไขได้' : 'พร้อมสร้าง';
  updateCount();
  renderList();
  renderImportReview();
  await renderImages();
  $('#sidebar').classList.remove('open');
}
function updateCount() { $('#wordCount').textContent = `${$('#bodyInput').value.length.toLocaleString('th-TH')} ตัวอักษร`; }
function queueSave() { setSaveStatus('กำลังบันทึก...'); clearTimeout(state.saveTimer); state.saveTimer = setTimeout(flushSave, 450); updateCount(); }
async function flushSave() {
  clearTimeout(state.saveTimer); state.saveTimer = null;
  const note = activeNote();
  if (!note) return;
  const title = $('#titleInput').value;
  const body = $('#bodyInput').value;
  const summary = $('#summaryInput').value;
  if (title === note.title && body === note.body && summary === note.summary) { setSaveStatus('บันทึกแล้ว'); return; }
  const next = { ...note, title, body, summary, updated: Date.now() };
  try { await putNote(next); Object.assign(note, next); setSaveStatus('บันทึกแล้ว'); renderList(); $('#breadcrumbTitle').textContent = title || 'โน้ตใหม่'; }
  catch (error) { setSaveStatus('บันทึกไม่สำเร็จ'); toast('บันทึกไม่สำเร็จ: พื้นที่จัดเก็บอาจเต็ม'); console.error(error); }
}
async function renderImages() {
  state.imageUrls.forEach(URL.revokeObjectURL);
  state.imageUrls = [];
  const note = activeNote();
  const assets = note ? await Promise.all(note.imageIds.map(getImage)) : [];
  state.images = assets.filter(Boolean);
  $('#imageCount').textContent = `${state.images.length} รูป`;
  $('#dropzone').hidden = false;
  $('#imageGrid').innerHTML = state.images.map(asset => {
    const url = URL.createObjectURL(asset.blob); state.imageUrls.push(url);
    return `<div class="image-card"><img src="${url}" alt="${escapeHtml(asset.name)}"><button data-remove-image="${escapeHtml(asset.id)}" aria-label="ลบรูป ${escapeHtml(asset.name)}">×</button></div>`;
  }).join('');
}
async function addImages(files) {
  const note = activeNote(); if (!note) return;
  const images = [...files].filter(file => file.type.startsWith('image/'));
  if (!images.length) return;
  for (const file of images) {
    const id = uid();
    await putImage({ id, name: file.name || `รูป-${note.imageIds.length + 1}.png`, type: file.type, blob: file });
    note.imageIds.push(id);
  }
  note.updated = Date.now(); await putNote(note); await renderImages(); renderList(); toast(`เพิ่มรูปแล้ว ${images.length} รูป`);
}
async function removeImage(id) {
  const note = activeNote(); if (!note) return;
  note.imageIds = note.imageIds.filter(item => item !== id);
  await putNote(note); await deleteImageDb(id); await renderImages(); toast('ลบรูปแล้ว');
}
function insertAtCursor(text) {
  const area = $('#bodyInput'), start = area.selectionStart, end = area.selectionEnd;
  area.setRangeText(text, start, end, 'end'); area.focus(); queueSave();
}
function handlePaste(event) {
  const items = [...(event.clipboardData?.items || [])];
  const imageFiles = items.filter(item => item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
  if (!imageFiles.length) return; // Let the browser insert PDF text exactly as copied.
  event.preventDefault();
  const text = event.clipboardData.getData('text/plain');
  if (text && event.target === $('#bodyInput')) insertAtCursor(text);
  addImages(imageFiles).catch(error => { console.error(error); toast('เพิ่มรูปไม่สำเร็จ'); });
}
function compareImportedText(noteBody, entries) {
  let compact = noteBody.toLocaleLowerCase().replace(/\s+/g, '');
  let total = 0, repeated = 0, added = 0;
  const reviewed = entries.map(entry => {
    const newLines = [];
    let fileTotal = 0, fileRepeated = 0;
    let pageMarker = '', insertedPage = '';
    for (const original of entry.text.split(/\r\n?|\n/)) {
      const line = original.trim();
      if (!line) continue;
      if (/^--- หน้า \d+ ---$/.test(line)) { pageMarker = line; continue; }
      const normalized = line.toLocaleLowerCase().replace(/\s+/g, '');
      fileTotal++; total++;
      if (normalized && compact.includes(normalized)) { fileRepeated++; repeated++; }
      else {
        if (pageMarker && pageMarker !== insertedPage) { newLines.push(pageMarker); insertedPage = pageMarker; }
        newLines.push(original); added++; compact += normalized;
      }
    }
    return { ...entry, newText: newLines.join('\n').trim(), total: fileTotal, repeated: fileRepeated };
  });
  return { entries: reviewed, total, repeated, added };
}
function pendingForActiveNote() { return state.pendingImports.get(state.activeId); }
function renderImportReview() {
  const pending = pendingForActiveNote(), panel = $('#importReview');
  if (!pending || !pending.requiresReview) { panel.hidden = true; return; }
  panel.hidden = false;
  const comparison = compareImportedText($('#bodyInput').value, pending.entries);
  $('#importReviewTitle').textContent = `${pending.entries.length} ไฟล์พร้อมตรวจ`;
  $('#importStatus').textContent = pending.status || 'กรุณาตรวจข้อความที่อ่านได้ก่อนเพิ่ม';
  $('#importFileList').innerHTML = comparison.entries.map(entry => `<div class="import-file"><span>${escapeHtml(entry.name)}</span><span>${entry.kind === 'pdf' ? `PDF · ${entry.pages} หน้า` : 'ข้อความ'} · ใหม่ ${entry.total - entry.repeated}/${entry.total} บรรทัด</span></div>`).join('');
  $('#importComparison').innerHTML = `<div class="import-stat"><strong>${comparison.total}</strong><small>บรรทัดที่อ่านได้</small></div><div class="import-stat"><strong>${comparison.added}</strong><small>ข้อมูลใหม่</small></div><div class="import-stat"><strong>${comparison.repeated}</strong><small>ซ้ำกับโน้ต</small></div>`;
  $('#importPreview').value = comparison.entries.map(entry => `--- ${entry.name} ---\n${entry.text}`).join('\n\n');
  $('#textEncoding').parentElement.hidden = !pending.entries.some(entry => entry.kind === 'text');
  $('#addAllImport').disabled = state.importBusy;
}
async function stageFiles(fileList) {
  if (state.importBusy) return toast('กำลังอ่านไฟล์ก่อนหน้า กรุณารอสักครู่');
  const files = [...fileList]; if (!files.length) return;
  const imageFiles = files.filter(file => file.type.startsWith('image/'));
  if (imageFiles.length) { await addImages(imageFiles); setUploadStatus(`เพิ่มรูปแล้ว ${imageFiles.length} รูป`, 'done'); }
  const documentFiles = files.filter(file => /\.(txt|md|pdf)$/i.test(file.name));
  if (!documentFiles.length) { if (!imageFiles.length) toast('รองรับไฟล์ TXT, MD, PDF และรูปภาพ'); return; }
  const noteId = state.activeId;
  const pending = state.pendingImports.get(noteId) || { noteId, entries: [], status: '', requiresReview: false };
  state.pendingImports.set(noteId, pending);
  state.importBusy = true;
  let failed = 0;
  try {
    for (const file of documentFiles) {
      pending.status = `กำลังอ่าน ${file.name}...`;
      setUploadStatus(pending.status);
      renderImportReview();
      try {
        if (file.size > 25 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 25 MB');
        let text, pages = 0, kind = /\.pdf$/i.test(file.name) ? 'pdf' : 'text';
        if (kind === 'pdf') {
          const { extractPdfText } = await import('./pdf-reader.mjs');
          const result = await extractPdfText(file, (current, total) => { pending.status = `อ่าน PDF: ${file.name} หน้า ${current}/${total}`; setUploadStatus(pending.status); });
          text = result.text; pages = result.pages;
        } else {
          const { readTextFile } = await import('./text-reader.mjs');
          const decoded = await readTextFile(file);
          text = decoded.text;
          if (!text.trim()) throw new Error('ไม่พบข้อความในไฟล์');
          pending.entries.push({ name: file.name, kind, pages, text, bytes: decoded.bytes, encoding: decoded.encoding });
          continue;
        }
        if (!text.trim()) throw new Error('ไม่พบข้อความในไฟล์');
        pending.entries.push({ name: file.name, kind, pages, text });
        if (text.includes('\uFFFD')) pending.requiresReview = true;
      } catch (error) {
        console.error(error);
        failed++;
        pending.status = `อ่าน ${file.name} ไม่สำเร็จ: ${error.message}${location.protocol === 'file:' && /pdf/i.test(file.name) ? ' · ลองเปิดแอปผ่าน start.cmd' : ''}`;
        setUploadStatus(pending.status, 'error');
        toast(pending.status);
      }
    }
    if (pending.entries.length) {
      pending.status = pending.requiresReview ? 'พบอักขระที่อ่านไม่ชัด โปรดตรวจข้อความก่อนเพิ่ม' : 'อ่านไฟล์เสร็จแล้ว กำลังสร้างสรุป...';
      renderImportReview();
    } else if (!pending.entries.length) state.pendingImports.delete(noteId);
  } finally { state.importBusy = false; renderImportReview(); }
  if (!pending.entries.length) return;
  if (pending.requiresReview) {
    setUploadStatus(pending.status, 'error');
    $('#importReview').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (state.activeId !== noteId) return;
  if (!$('#titleInput').value.trim()) {
    $('#titleInput').value = documentFiles[0].name.replace(/\.(pdf|txt|md)$/i, '');
    queueSave();
  }
  const added = await applyImported({ auto: true });
  if (!added) return;
  await generateSummary();
  setUploadStatus(`อ่านและสรุปแล้ว ${pending.entries.length} ไฟล์${failed ? ` · มี ${failed} ไฟล์ที่อ่านไม่สำเร็จ` : ''}`, failed ? 'error' : 'done');
  try { if (localStorage.getItem('note-local-ai-enabled') === '1') runLocalAi({ automatic: true }); } catch {}
}
async function applyImported({ auto = false } = {}) {
  const pending = pendingForActiveNote(); if (!pending || state.importBusy) return;
  await flushSave();
  const additions = pending.entries.map(entry => entry.text
    ? `--- นำเข้าจาก: ${entry.name} ---\n${entry.text}` : '').filter(Boolean);
  if (!additions.length) { toast('ไม่มีข้อมูลใหม่ให้เพิ่ม'); return false; }
  const area = $('#bodyInput');
  area.value += `${area.value.trim() ? '\n\n' : ''}${additions.join('\n\n')}\n`;
  queueSave(); await flushSave();
  state.pendingImports.delete(state.activeId); renderImportReview(); updateCount();
  if (!auto) { setUploadStatus('เพิ่มข้อมูลแล้ว กำลังสร้างสรุป...', 'working'); await generateSummary(); setUploadStatus('อ่านและสรุปแล้ว', 'done'); }
  return true;
}
function extractPoints(text, max = 5) {
  const lines = text.split(/\n+/).map(line => line.trim()).filter(line => line && !/^--- (?:หน้า \d+|นำเข้าจาก:)/.test(line));
  const candidates = lines.flatMap(line => line.length > 220 ? line.split(/(?<=[.!?。！？])\s+/) : [line]);
  const seen = new Set();
  return candidates.filter(line => { const key = line.toLocaleLowerCase().slice(0, 80); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, max).map(line => line.slice(0, 190));
}
function localSummary(text) {
  const clean = text.split(/\r\n?|\n/).map(line => line.trim())
    .filter(line => line.length > 15 && !/^--- (?:หน้า \d+|นำเข้าจาก:)/.test(line));
  const candidates = clean.flatMap(line => line.length > 380
    ? (line.match(/.{1,380}/gu) || []) : [line]).slice(0, 4000);
  if (!candidates.length) return extractPoints(text, 6).map(point => `• ${point}`).join('\n');
  const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
  const words = value => [...segmenter.segment(value.toLocaleLowerCase())]
    .filter(part => part.isWordLike && part.segment.length > 1)
    .map(part => part.segment);
  const frequency = new Map();
  for (const line of candidates) for (const word of new Set(words(line)))
    frequency.set(word, (frequency.get(word) || 0) + 1);
  const ranked = candidates.map((line, index) => {
    const tokens = words(line);
    const score = tokens.reduce((sum, word) => sum + Math.log1p(frequency.get(word) || 0), 0) /
      Math.sqrt(Math.max(tokens.length, 1));
    return { line, index, score: score + (index < 5 ? .7 : 0) };
  }).sort((a, b) => b.score - a.score);
  const chosen = [];
  for (const item of ranked) {
    const key = item.line.replace(/\s+/g, '').toLocaleLowerCase();
    if (chosen.some(other => other.line.replace(/\s+/g, '').toLocaleLowerCase().includes(key.slice(0, 45)))) continue;
    chosen.push(item);
    if (chosen.length === Math.min(8, Math.max(4, Math.ceil(candidates.length / 12)))) break;
  }
  return chosen.sort((a, b) => a.index - b.index).map(item => `• ${item.line}`).join('\n');
}
async function generateSummary() {
  await flushSave();
  const note = activeNote(), source = note?.body.trim();
  if (!source) { $('#bodyInput').focus(); return toast('เพิ่มข้อความหรือไฟล์ก่อนสร้างสรุป'); }
  $('#summaryInput').value = localSummary(source);
  $('#summaryMethod').textContent = 'สรุปอัตโนมัติจากต้นฉบับ · แก้ไขได้';
  queueSave();
  await flushSave();
  $('#summarySection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function runLocalAi({ automatic = false } = {}) {
  await flushSave();
  const note = activeNote(), source = note?.body?.trim();
  if (!source) return toast('เพิ่ม PDF หรือข้อความก่อนใช้ AI ในเครื่อง');
  const noteId = note.id;
  const button = $('#localAiButton');
  if (button.disabled) return;
  button.disabled = true;
  $('#localAiStatus').textContent = automatic ? 'AI กำลังปรับสรุปให้อัตโนมัติ...' : 'กำลังเปิด AI ในเครื่อง...';
  try {
    const { summarizeOnDevice } = await import('./local-ai.mjs');
    const summary = await summarizeOnDevice(source, localSummary(source), message => {
      $('#localAiStatus').textContent = message;
    });
    if (state.activeId !== noteId || activeNote()?.body?.trim() !== source) return;
    $('#summaryInput').value = summary;
    $('#summaryMethod').textContent = 'สรุปด้วย AI ในเครื่อง · แก้ไขได้';
    queueSave();
    await flushSave();
    $('#localAiStatus').textContent = 'AI สรุปเสร็จแล้ว · ข้อความไม่ได้ส่งไปเซิร์ฟเวอร์';
    $('#summarySection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { localStorage.setItem('note-local-ai-enabled', '1'); } catch {}
  } catch (error) {
    console.error(error);
    $('#localAiStatus').textContent = `ใช้ AI ในเครื่องไม่สำเร็จ: ${error.message} · สรุปอัตโนมัติยังอยู่`;
    try { localStorage.removeItem('note-local-ai-enabled'); } catch {}
  } finally { button.disabled = false; }
}
function download(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function blobToDataUrl(blob) { return new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); }); }
function crc32(data) { let crc = -1; for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; }
function zipFiles(files) {
  const encoder = new TextEncoder(), chunks = [], central = []; let offset = 0;
  const u16 = (view, at, n) => view.setUint16(at, n, true), u32 = (view, at, n) => view.setUint32(at, n, true);
  for (const file of files) {
    const name = encoder.encode(file.name), data = file.data, crc = crc32(data);
    const header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
    u32(h, 0, 0x04034b50); u16(h, 4, 20); u16(h, 6, 0x0800); u16(h, 8, 0); u32(h, 14, crc); u32(h, 18, data.length); u32(h, 22, data.length); u16(h, 26, name.length); header.set(name, 30);
    chunks.push(header, data);
    const entry = new Uint8Array(46 + name.length), e = new DataView(entry.buffer);
    u32(e, 0, 0x02014b50); u16(e, 4, 20); u16(e, 6, 20); u16(e, 8, 0x0800); u32(e, 16, crc); u32(e, 20, data.length); u32(e, 24, data.length); u16(e, 28, name.length); u32(e, 42, offset); entry.set(name, 46);
    central.push(entry); offset += header.length + data.length;
  }
  const centralLength = central.reduce((sum, item) => sum + item.length, 0), end = new Uint8Array(22), e = new DataView(end.buffer);
  u32(e, 0, 0x06054b50); u16(e, 8, files.length); u16(e, 10, files.length); u32(e, 12, centralLength); u32(e, 16, offset);
  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}
async function exportNote(type) {
  await flushSave(); const note = activeNote(); if (!note) return;
  $('#exportModal').hidden = true;
  const title = note.title || 'โน้ตไม่มีชื่อ';
  if (['summary', 'summary-md', 'print-summary'].includes(type) && !note.summary.trim()) return toast('สร้างหรือเขียนสรุปก่อนส่งออก');
  if (type === 'summary') { download(new Blob([`${title}\n\n${note.summary}\n`], { type: 'text/plain;charset=utf-8' }), fileName(`${title}-สรุป`, 'txt')); return; }
  if (type === 'summary-md') { download(new Blob([`# ${title}\n\n## สรุป\n\n${note.summary.trim()}\n`], { type: 'text/markdown;charset=utf-8' }), fileName(`${title}-สรุป`, 'md')); return; }
  if (type === 'print' || type === 'print-summary') {
    const assets = (await Promise.all(note.imageIds.map(getImage))).filter(Boolean);
    const imageHtml = type === 'print' ? (await Promise.all(assets.map(async asset => `<figure><img src="${await blobToDataUrl(asset.blob)}" alt="${escapeHtml(asset.name)}"><figcaption>${escapeHtml(asset.name)}</figcaption></figure>`))).join('') : '';
    $('#printContent').innerHTML = `<h1>${escapeHtml(title)}</h1>${note.summary ? `<aside><strong>สรุป</strong><pre>${escapeHtml(note.summary)}</pre></aside>` : ''}${type === 'print' ? `<h2>ต้นฉบับ</h2><pre>${escapeHtml(note.body)}</pre>${imageHtml}` : ''}`;
    await Promise.all([...$('#printContent').querySelectorAll('img')].map(image => image.decode().catch(() => {})));
    window.print(); return;
  }
  const assets = (await Promise.all(note.imageIds.map(getImage))).filter(Boolean);
  if (type === 'backup') {
    const images = await Promise.all(assets.map(async asset => ({ id: asset.id, name: asset.name, type: asset.type, data: await blobToDataUrl(asset.blob) })));
    download(new Blob([JSON.stringify({ format: 'laonote-v1', note, images }, null, 2)], { type: 'application/json' }), fileName(title, 'json')); return;
  }
  if (type === 'html') {
    const imageHtml = (await Promise.all(assets.map(async asset => `<figure><img src="${await blobToDataUrl(asset.blob)}" alt="${escapeHtml(asset.name)}"><figcaption>${escapeHtml(asset.name)}</figcaption></figure>`))).join('');
    const html = `<!doctype html><html lang="th"><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:16px/1.8 system-ui,sans-serif;max-width:780px;margin:60px auto;padding:0 24px;color:#26352a}h1{font-size:2em}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}img{max-width:100%;border-radius:10px}figcaption{color:#777;font-size:12px}aside{background:#f1f5ec;padding:18px;border-radius:10px}</style><h1>${escapeHtml(title)}</h1>${note.summary ? `<aside><strong>สรุป</strong><pre>${escapeHtml(note.summary)}</pre></aside>` : ''}<pre>${escapeHtml(note.body)}</pre>${imageHtml}</html>`;
    download(new Blob([html], { type: 'text/html;charset=utf-8' }), fileName(title, 'html')); return;
  }
  if (type === 'markdown') {
    let md = `# ${title}\n\n`;
    if (note.summary) md += `## สรุป\n\n${note.summary}\n\n`;
    md += `${note.body}\n`;
    if (assets.length) md += '\n## รูปประกอบ\n\n' + assets.map((asset, index) => `![${asset.name}](images/${index + 1}-${asset.name.replace(/[\\/]/g, '-')})`).join('\n\n') + '\n';
    const files = [{ name: fileName(title, 'md'), data: new TextEncoder().encode(md) }];
    for (let i = 0; i < assets.length; i++) files.push({ name: `images/${i + 1}-${assets[i].name.replace(/[\\/]/g, '-')}`, data: new Uint8Array(await assets[i].blob.arrayBuffer()) });
    download(zipFiles(files), fileName(title, 'zip'));
  }
}
async function importBackup(file) {
  if (file.size > 80 * 1024 * 1024) throw new Error('ไฟล์สำรองใหญ่เกิน 80 MB');
  const backup = JSON.parse(await file.text());
  if (backup.format !== 'laonote-v1' || !backup.note || !Array.isArray(backup.images)) throw new Error('รูปแบบไฟล์สำรองไม่ถูกต้อง');
  const note = newBlankNote();
  note.title = String(backup.note.title || 'โน้ตนำเข้า').slice(0, 160);
  note.body = String(backup.note.body || '');
  note.summary = String(backup.note.summary || '');
  for (const asset of backup.images) {
    if (typeof asset.data !== 'string' || !asset.data.startsWith('data:image/')) continue;
    const response = await fetch(asset.data), blob = await response.blob(), id = uid();
    await putImage({ id, name: String(asset.name || 'รูปนำเข้า'), type: blob.type, blob });
    note.imageIds.push(id);
  }
  await flushSave(); await putNote(note); state.notes.unshift(note); await selectNote(note.id);
  $('#exportModal').hidden = true; toast('นำเข้าโน้ตสำเร็จ');
}
async function deleteActiveNote() {
  const note = activeNote(); if (!note || !confirm(`ลบโน้ต “${note.title || 'โน้ตไม่มีชื่อ'}” และรูปประกอบทั้งหมด?`)) return;
  await flushSave();
  for (const id of note.imageIds) await deleteImageDb(id);
  await deleteNoteDb(note.id); state.pendingImports.delete(note.id); state.notes = state.notes.filter(item => item.id !== note.id); state.activeId = null;
  if (!state.notes.length) await createNote(); else await selectNote(state.notes[0].id);
  toast('ลบโน้ตแล้ว');
}
function bindEvents() {
  $('#newNote').addEventListener('click', createNote);
  $('#searchInput').addEventListener('input', renderList);
  $('#noteList').addEventListener('click', event => { const item = event.target.closest('[data-id]'); if (item) selectNote(item.dataset.id); });
  $('#noteList').addEventListener('keydown', event => { if (event.key === 'Enter') event.target.closest('[data-id]')?.click(); });
  $('#titleInput').addEventListener('input', queueSave);
  $('#bodyInput').addEventListener('input', queueSave);
  $('#summaryInput').addEventListener('input', queueSave);
  $('#bodyInput').addEventListener('paste', handlePaste);
  $('#dropFileInput').addEventListener('change', event => { stageFiles(event.target.files).catch(error => { console.error(error); setUploadStatus(`นำเข้าไม่สำเร็จ: ${error.message}`, 'error'); }); event.target.value = ''; });
  $('#addAllImport').addEventListener('click', () => applyImported().catch(error => { console.error(error); toast('เพิ่มข้อมูลไม่สำเร็จ'); }));
  $('#textEncoding').addEventListener('change', async event => {
    const pending = pendingForActiveNote(); if (!pending) return;
    try {
      const { decodeTextBytes } = await import('./text-reader.mjs');
      for (const entry of pending.entries.filter(item => item.kind === 'text')) {
        const decoded = decodeTextBytes(entry.bytes, event.target.value);
        entry.text = decoded.text; entry.encoding = decoded.encoding;
      }
      pending.status = 'เปลี่ยนการอ่าน TXT แล้ว ตรวจสระและวรรณยุกต์ก่อนเพิ่ม';
      renderImportReview();
    } catch { toast('การเข้ารหัสนี้อ่านไฟล์ไม่ได้ ลองเลือกอัตโนมัติหรือ Thai Windows-874'); }
  });
  $('#dismissImport').addEventListener('click', () => { state.pendingImports.delete(state.activeId); renderImportReview(); });
  $('#imageGrid').addEventListener('click', event => { const button = event.target.closest('[data-remove-image]'); if (button) removeImage(button.dataset.removeImage); });
  for (const zone of [$('#dropzone'), $('#fileDrop')]) {
    for (const name of ['dragenter', 'dragover']) zone.addEventListener(name, event => { event.preventDefault(); zone.classList.add('dragging'); });
    for (const name of ['dragleave', 'drop']) zone.addEventListener(name, event => { event.preventDefault(); zone.classList.remove('dragging'); });
    zone.addEventListener('drop', event => { event.stopPropagation(); stageFiles(event.dataTransfer.files).catch(error => { console.error(error); toast('นำเข้าไฟล์ไม่สำเร็จ'); }); });
  }
  $('#summaryButton').addEventListener('click', generateSummary);
  $('#localAiButton').addEventListener('click', () => runLocalAi());
  $('#copySummary').addEventListener('click', async () => { const summary = $('#summaryInput').value.trim(); if (!summary) return toast('ยังไม่มีสรุป'); try { await navigator.clipboard.writeText(summary); toast('คัดลอกสรุปแล้ว'); } catch { toast('คัดลอกไม่สำเร็จ'); } });
  $('#downloadSummary').addEventListener('click', () => exportNote('summary-md'));
  $('#exportButton').addEventListener('click', () => { $('#exportModal').hidden = false; });
  $('#deleteButton').addEventListener('click', deleteActiveNote);
  $('#backupInput').addEventListener('change', async event => { const file = event.target.files[0]; if (file) try { await importBackup(file); } catch (error) { console.error(error); toast(`นำเข้าไม่สำเร็จ: ${error.message}`); } event.target.value = ''; });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { $(`#${button.dataset.close}`).hidden = true; }));
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.hidden = true; }));
  document.querySelectorAll('[data-export]').forEach(button => button.addEventListener('click', () => exportNote(button.dataset.export).catch(error => { console.error(error); toast('ส่งออกไม่สำเร็จ'); })));
  $('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); flushSave(); toast('บันทึกแล้ว'); } if (event.key === 'Escape') document.querySelectorAll('.modal-backdrop').forEach(el => el.hidden = true); });
  window.addEventListener('beforeunload', () => { if (state.saveTimer) flushSave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.saveTimer) flushSave(); });
}
async function init() {
  bindEvents();
  $('#localFileNotice').hidden = location.protocol !== 'file:';
  if (!navigator.gpu) {
    $('#localAiButton').disabled = true;
    $('#localAiStatus').textContent = 'เครื่องนี้ยังไม่รองรับ WebGPU · สรุปอัตโนมัติยังใช้ได้';
  }
  try { state.db = await openDb(); state.notes = await getAllNotes(); if (!state.notes.length) { const note = newBlankNote(); state.notes.push(note); await putNote(note); } await selectNote([...state.notes].sort((a,b) => b.updated-a.updated)[0].id); setSaveStatus('บันทึกแล้ว'); }
  catch (error) { console.error(error); setSaveStatus('จัดเก็บไม่ได้'); toast('เปิดที่เก็บข้อมูลไม่สำเร็จ กรุณาใช้เบราว์เซอร์ปกติ'); }
}
init();
