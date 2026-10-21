import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

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

console.log(`ตรวจผ่าน: อ้างถึง ${usedIds.size} ปุ่ม/ช่องครบ และการเทียบข้อมูลใหม่กับข้อมูลซ้ำถูกต้อง`);
