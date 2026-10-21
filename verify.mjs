import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { decodeTextBytes } from './text-reader.mjs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const usedIds = new Set([...app.matchAll(/\$\('#([^']+)'\)/g)].map(match => match[1]));
const missing = [...usedIds].filter(id => !ids.has(id));
assert.deepEqual(missing, [], `Missing elements: ${missing.join(', ')}`);

const start = app.indexOf('function compareImportedText(');
const end = app.indexOf('function pendingForActiveNote()', start);
assert.ok(start >= 0 && end > start);
const compareImportedText = vm.runInNewContext(`${app.slice(start, end)}\ncompareImportedText`);
const result = compareImportedText('หัวข้อเดิม\nเนื้อหาซ้ำ', [{ name: 'test.pdf', text: '--- หน้า 1 ---\nเนื้อหาซ้ำ\nข้อมูลใหม่\n--- หน้า 2 ---\nอีกข้อใหม่' }]);
assert.equal(result.total, 3);
assert.equal(result.repeated, 1);
assert.equal(result.added, 2);
assert.match(result.entries[0].newText, /--- หน้า 1 ---\nข้อมูลใหม่/);
assert.match(result.entries[0].newText, /--- หน้า 2 ---\nอีกข้อใหม่/);

const thai = 'สรุปเรื่องน้ำ: ก๊าซ อิเล็กทรอนิกส์ ภาษาไทยสระอำ';
const utf8 = new TextEncoder().encode(thai);
assert.equal(decodeTextBytes(utf8).text, thai);
assert.equal(decodeTextBytes(new Uint8Array([0xa1, 0xd2]), 'windows-874').text, 'กา');
assert.equal(decodeTextBytes(new Uint8Array([0xa1, 0xd2])).text, 'กา');
assert.ok(ids.has('addAllImport'));
assert.ok(!ids.has('addNewImport') && !ids.has('aiEndpoint'));
assert.ok(ids.has('localAiButton') && ids.has('uploadStatus'));

console.log(`ตรวจผ่าน: อ้างถึง ${usedIds.size} ปุ่ม/ช่องครบ ข้อความไทย UTF-8/Windows-874 ครบ และไม่มีขั้นตอน API key`);
