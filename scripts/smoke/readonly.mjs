// Smoke Tier 1: chi doc, khong ghi gi len tai khoan. Mot lan login cho tat ca check
// de chi ton dung 1 identify.
// Chay: node --env-file=.env scripts/smoke/readonly.mjs
// Khong chay trong CI.
import { appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const { Client } = require('../../src/index.js');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Thieu bien moi truong DISCORD_TOKEN');
  process.exit(1);
}

// Nghi giua moi lan goi REST. Discord danh dau tai khoan burst request la bot.
const CALL_DELAY_MS = Number(process.env.SMOKE_CALL_DELAY_MS ?? 2000);

// File nay duoc commit, nen chi ghi ngay va pass/fail. Gia tri tra ve (so guild,
// so ban be, setting, tag tai khoan) chi hien tren console roi mat.
const LOG_FILE = new URL('results.md', import.meta.url);

const client = new Client({});
const results = [];

// Chi log so dem va kieu du lieu, khong log ten guild / id ban be / noi dung setting.
async function check(name, fn) {
  await sleep(CALL_DELAY_MS);
  const startedAt = Date.now();
  try {
    const detail = (await fn()) ?? 'ok';
    results.push({ name, status: 'PASS', detail, ms: Date.now() - startedAt });
  } catch (error) {
    results.push({ name, status: 'FAIL', detail: `${error.name}: ${error.message}`, ms: Date.now() - startedAt });
  }
}

const timeout = setTimeout(() => {
  console.error('FAIL: khong nhan duoc ready sau 30s');
  process.exit(1);
}, 30_000);

client.on('error', error => {
  console.error('FAIL:', error);
  process.exit(1);
});

client.once('ready', async () => {
  clearTimeout(timeout);
  results.push({
    name: 'ready + client.user',
    status: 'PASS',
    detail: `${client.user.tag} (${client.user.id})`,
    ms: 0,
  });

  // Doc tu cache READY, khong ton request.
  await check('relationships tu READY', () => {
    const { friendCache, blockedCache, incomingCache, outgoingCache } = client.relationships;
    return `friend=${friendCache.size} blocked=${blockedCache.size} in=${incomingCache.size} out=${outgoingCache.size}`;
  });

  await check('guilds tu READY', () => `guilds=${client.guilds.cache.size} channels=${client.channels.cache.size}`);

  await check('user_guild_settings da patch vao Guild', () => {
    const patched = client.guilds.cache.filter(guild => Object.keys(guild.settings.raw ?? {}).length > 0);
    return `guild co setting=${patched.size}/${client.guilds.cache.size}`;
  });

  await check('settings.fetch()', async () => {
    // Luu y: fetch nay dong bo lai presence hien tai len gateway (dung gia tri cu,
    // nen khong doi trang thai nhin thay duoc).
    await client.settings.fetch();
    return `field=${Object.keys(client.settings.raw).length} theme=${client.settings.theme ?? '?'}`;
  });

  await check('sessions.fetch()', async () => {
    const sessions = await client.sessions.fetch();
    const hash = client.sessions.currentSessionIdHash;
    return `session=${sessions.size} currentSession=${client.sessions.currentSession ? 'co' : 'khong'} hash=${
      hash ? 'co' : 'khong'
    }`;
  });

  await check('notes.fetch(ban be dau tien)', async () => {
    const friendId = client.relationships.friendCache.firstKey();
    if (!friendId) return 'bo qua: khong co ban be trong cache';
    const note = await client.notes.fetch(friendId);
    return `note dai ${note.length} ky tu`;
  });

  await check('users.fetch(chinh minh, force)', async () => {
    const user = await client.users.fetch(client.user.id, { force: true });
    return `id khop=${user.id === client.user.id} bot=${user.bot}`;
  });

  const failed = results.filter(result => result.status === 'FAIL');
  const passed = results.length - failed.length;

  // Console: kem gia tri tra ve, de con soi khi fail.
  console.log(
    results.map(result => `${result.status.padEnd(4)} ${result.name} — ${result.detail} (${result.ms}ms)`).join('\n'),
  );
  console.log(`tong: ${passed}/${results.length} pass`);

  // File: chi ngay va pass/fail.
  const row = [
    `| ${new Date().toISOString().replace('T', ' ').slice(0, 16)} | readonly | ${passed}/${results.length} |`,
    failed.length ? ` ${failed.map(result => result.name).join(', ')} |` : ' — |',
  ].join('');
  appendFileSync(LOG_FILE, `${row}\n`);
  console.log(`Da ghi ket qua vao ${LOG_FILE.pathname}`);

  client.destroy();
  process.exit(failed.length ? 1 : 0);
});

await client.login(token);
