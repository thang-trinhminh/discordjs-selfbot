// Soi dung nhung gi `npm publish` se day len, truoc khi day.
//
// `files` trong package.json la danh sach cho phep, nhung chi can mot dong them
// vao do (hay mot file la lot vao src/) la .env, ket qua smoke hay khoa rieng di
// thang len npm — va npm khong cho go mot version da publish ra khoi tay nguoi
// da tai. Chay: node scripts/check-package.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const ALLOWED = [
  /^src\//,
  /^typings\/[^/]+\.(d\.ts|json)$/,
  /^(CHANGELOG\.md|LICENSE|LICENSE-APACHE|NOTICE|README(\.vi)?\.md|package\.json)$/,
];
const FORBIDDEN = [/(^|\/)\.env(\.|$)/, /\.(pem|key|p12|pfx)$/, /(^|\/)\.npmrc$/, /^(test|scripts)\//, /\.test-d\.ts$/];
const SECRETS = [
  ['token Discord', /[MNO][\w-]{23,27}\.[\w-]{6}\.[\w-]{27,40}/],
  ['token npm', /npm_[A-Za-z0-9]{36}/],
  ['token GitHub', /gh[pousr]_[A-Za-z0-9]{36}|github_pat_\w{22,}/],
  ['khoa rieng', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

// Npm 10 tren Windows can shell; o day chi chay tren Linux/macOS va CI.
// `prepare` (husky) van chay du co --ignore-scripts va in ra stdout truoc JSON,
// nen cat tu cho mo mang JSON.
const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8',
  env: { ...process.env, HUSKY: '0' },
});
const [pack] = JSON.parse(output.slice(output.search(/\[\s*\{/)));
const files = pack.files.map(file => file.path);
const problems = [];

for (const file of files) {
  if (FORBIDDEN.some(pattern => pattern.test(file))) problems.push(`file cam: ${file}`);
  else if (!ALLOWED.some(pattern => pattern.test(file))) problems.push(`file la, chua duoc cho phep: ${file}`);

  const content = readFileSync(file, 'utf8');
  for (const [name, pattern] of SECRETS) {
    if (pattern.test(content)) problems.push(`${name} trong ${file}`);
  }
}

if (problems.length) {
  console.error(`Goi ${pack.name}@${pack.version} khong an toan de publish:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`${pack.name}@${pack.version}: ${files.length} file, ${(pack.size / 1024).toFixed(0)} kB, khong co gi la`);
