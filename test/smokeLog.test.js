'use strict';

const assert = require('node:assert');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');

// `log.mjs` la ESM va viet file that, nen test nay chay no tren mot file tam.
async function appendResults(...args) {
  const { appendResults: run } = await import('../scripts/smoke/log.mjs');
  return run(...args);
}

async function withFile(body) {
  const directory = mkdtempSync(join(tmpdir(), 'smoke-log-'));
  const file = join(directory, 'results.md');
  try {
    // Phai await truoc khi xoa, khong thi thu muc bien mat giua chung.
    return await body(file);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function resultRows(content) {
  return content
    .split('\n')
    .filter(line => /^\| \d{4}-\d{2}-\d{2} /.test(line))
    .map(line =>
      line
        .split('|')
        .slice(1, -1)
        .map(cell => cell.trim()),
    );
}

function tallyRows(content) {
  const start = content.indexOf('| Suite | PASS | FAIL | SKIP |');
  const end = content.indexOf('| Date | Suite | Check | Result |');
  return content
    .slice(start, end)
    .split('\n')
    .filter(line => line.startsWith('|') && !line.includes('Suite | PASS') && !line.startsWith('| ---'));
}

test('chay lai mot suite thay the dong cu chu khong noi them', async () => {
  await withFile(async file => {
    writeFileSync(file, '# Ket qua\n\n## Results\n');

    await appendResults(file, 'voice', [{ name: 'joinChannel()', status: 'FAIL' }]);
    await appendResults(file, 'voice', [{ name: 'joinChannel()', status: 'PASS' }]);

    const rows = resultRows(readFileSync(file, 'utf8'));
    assert.strictEqual(rows.length, 1);
    assert.deepStrictEqual(rows[0].slice(1), ['voice', 'joinChannel()', 'PASS']);
  });
});

test('bang tally khong bi doc lai nhu du lieu o lan chay sau', async () => {
  await withFile(async file => {
    writeFileSync(file, '# Ket qua\n\n## Results\n');

    // Ba lan chay lien tiep. Bug cu: moi lan lai nuot bang tally cua lan truoc va
    // de ra mot suite ten la con so, vi `| write | 15 | 0 | 5 |` cung co 4 o.
    for (let round = 0; round < 3; round++) {
      await appendResults(file, 'write', [
        { name: 'a()', status: 'PASS' },
        { name: 'b()', status: 'SKIP' },
      ]);
      await appendResults(file, 'voice', [{ name: 'joinChannel()', status: 'PASS' }]);
    }

    const content = readFileSync(file, 'utf8');
    const rows = resultRows(content);
    assert.strictEqual(rows.length, 3, 'chi duoc co 3 dong ket qua that');

    const suites = [...new Set(rows.map(row => row[1]))].sort();
    assert.deepStrictEqual(suites, ['voice', 'write']);

    const tally = tallyRows(content);
    assert.deepStrictEqual(tally.sort(), ['| voice | 1 | 0 | 0 |', '| write | 1 | 0 | 1 |']);
  });
});

test('doi ten check khong de lai dong mo coi', async () => {
  await withFile(async file => {
    writeFileSync(file, '# Ket qua\n\n## Results\n');

    await appendResults(file, 'voice', [{ name: 'ten cu()', status: 'PASS' }]);
    await appendResults(file, 'voice', [{ name: 'ten moi()', status: 'PASS' }]);

    const rows = resultRows(readFileSync(file, 'utf8'));
    assert.deepStrictEqual(
      rows.map(row => row[2]),
      ['ten moi()'],
    );
  });
});
