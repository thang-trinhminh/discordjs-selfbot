'use strict';

const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const read = file => readFileSync(join(root, file), 'utf8');

const typings = read('typings/index.d.ts');
const docs = { 'docs/API.md': read('docs/API.md'), 'docs/API.vi.md': read('docs/API.vi.md') };

// Chỉ soát khối selfbot. Phần upstream đã có tài liệu ở discord.js.dev.
const start = typings.indexOf('//#region Selfbot');
const region = typings.slice(start, typings.indexOf('//#endregion', start));

/**
 * Cắt thân của một khối khai báo, đếm ngoặc để không đứt ở kiểu lồng nhau.
 * @param {string} declaration Dòng mở đầu, ví dụ `export interface Client`
 * @returns {string} Phần trong ngoặc nhọn
 */
function body(declaration) {
  const from = region.indexOf(declaration);
  assert.notStrictEqual(from, -1, `Không tìm thấy "${declaration}" trong typings`);

  let depth = 0;
  for (let i = region.indexOf('{', from); i < region.length; i++) {
    if (region[i] === '{') depth++;
    else if (region[i] === '}' && --depth === 0) return region.slice(from, i);
  }

  throw new Error(`Khối "${declaration}" không đóng ngoặc`);
}

const names = (source, pattern) => [...source.matchAll(pattern)].map(match => match[1]);

// Tên cấp cao nhất, và các thành viên thêm vào Client/ClientUser bằng declaration
// merging — đó là bề mặt người dùng gọi tới. Interface mô tả tham số thì bỏ qua:
// chúng nằm trong chữ ký của method đã soát.
const surface = [
  ...names(region, /^export (?:abstract )?(?:class|function|const) (\w+)/gm),
  ...names(body('export interface Client<'), /^ {2}(?:get )?(\w+)[(<:]/gm),
  ...names(body('export interface ClientUser'), /^ {2}(\w+)\(/gm),
  ...names(body('export interface ClientEvents'), /^ {2}(\w+):/gm),
];

test('mọi API selfbot đều có trong docs/API.md', () => {
  assert.ok(surface.length > 50, `Chỉ tìm được ${surface.length} tên, regex hỏng rồi`);

  for (const [file, content] of Object.entries(docs)) {
    const missing = surface.filter(name => !content.includes(name));
    assert.deepStrictEqual(missing, [], `${file} thiếu: ${missing.join(', ')}`);
  }
});
