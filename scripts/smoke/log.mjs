// Ghi ket qua smoke vao results.md: mot bang duy nhat, moi check mot dong.
// Chay lai cung mot check thi ghi de dong cu va cap nhat ngay, khong noi them
// bang moi. File nay duoc commit nen chi ghi ten check, ngay va PASS/FAIL —
// khong ghi gia tri tra ve.
import { readFileSync, writeFileSync } from 'node:fs';

const HEADING = '## Results';
const TABLE_HEADER = ['| Date | Suite | Check | Result |', '| ---- | ----- | ----- | ------ |'];

// Tach mot dong bang markdown thanh cac o, bo o rong o hai dau.
function splitRow(line) {
  return line
    .split('|')
    .slice(1, -1)
    .map(cell => cell.trim());
}

/**
 * Gop ket qua cua mot lan chay vao bang trong results.md.
 * @param {URL|string} file Duong dan results.md
 * @param {string} suite Ten suite, vi du 'readonly' hoac 'write'
 * @param {Array<{name: string, status: string}>} results Ket qua tung check
 * @returns {string} Ngay da ghi, dang 'YYYY-MM-DD HH:MM'
 */
export function appendResults(file, suite, results) {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const content = readFileSync(file, 'utf8');
  const headingAt = content.indexOf(HEADING);
  if (headingAt === -1) throw new Error(`Khong tim thay "${HEADING}" trong ${file}`);

  // Giu nguyen moi thu truoc bang, ke ca phan van xuoi giai thich.
  const before = content.slice(0, headingAt + HEADING.length);
  const rows = new Map();

  for (const line of content.slice(headingAt).split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = splitRow(line);
    if (cells.length !== 4 || cells[0] === 'Date' || cells[0].startsWith('--')) continue;
    rows.set(`${cells[1]}|${cells[2]}`, cells);
  }

  // Doi ten mot check se de lai dong cu mo coi, vi khoa upsert la ten. Xoa het
  // dong cua suite nay roi ghi lai tu dau: lan chay sau cung la su that.
  for (const key of [...rows.keys()]) {
    if (key.startsWith(`${suite}|`)) rows.delete(key);
  }

  for (const result of results) {
    rows.set(`${suite}|${result.name}`, [stamp, suite, result.name, result.status]);
  }

  // Gom theo suite cho de doc; trong mot suite giu nguyen thu tu chay.
  const bySuite = new Map();
  for (const cells of rows.values()) {
    if (!bySuite.has(cells[1])) bySuite.set(cells[1], []);
    bySuite.get(cells[1]).push(cells);
  }

  const ordered = [...bySuite.values()].flat();
  const table = ordered.map(cells => `| ${cells.join(' | ')} |`);

  const tally = [...bySuite.entries()].map(([name, cells]) => {
    const count = status => cells.filter(row => row[3] === status).length;
    return `| ${name} | ${count('PASS')} | ${count('FAIL')} | ${count('SKIP')} |`;
  });

  const summary = ['| Suite | PASS | FAIL | SKIP |', '| ----- | ---- | ---- | ---- |', ...tally];
  writeFileSync(file, `${before}\n\n${[...summary, '', ...TABLE_HEADER, ...table].join('\n')}\n`);
  return stamp;
}
