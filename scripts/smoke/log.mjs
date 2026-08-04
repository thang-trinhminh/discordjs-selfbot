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

  for (const result of results) {
    rows.set(`${suite}|${result.name}`, [stamp, suite, result.name, result.status]);
  }

  const table = [...rows.values()].map(cells => `| ${cells.join(' | ')} |`);
  writeFileSync(file, `${before}\n\n${[...TABLE_HEADER, ...table].join('\n')}\n`);
  return stamp;
}
