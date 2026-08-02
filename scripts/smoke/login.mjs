// Smoke test P0-P2: login bang user token that va cho su kien ready.
// Chay: DISCORD_TOKEN=... node scripts/smoke/login.mjs
// Khong chay trong CI.
import { createRequire } from 'node:module';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';

const require = createRequire(import.meta.url);
const { Client } = require('../../src/index.js');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Thieu bien moi truong DISCORD_TOKEN');
  process.exit(1);
}

const client = new Client({});
const timeout = setTimeout(() => {
  console.error('FAIL: khong nhan duoc ready sau 30s');
  process.exit(1);
}, 30_000);

client.on('debug', message => console.log('[debug]', message));
client.on('error', error => {
  console.error('FAIL:', error);
  process.exit(1);
});

client.on('ready', () => {
  clearTimeout(timeout);
  console.log('PASS');
  console.log('  user   :', client.user.tag);
  console.log('  id     :', client.user.id);
  console.log('  guilds :', client.guilds.cache.size);
  client.destroy();
  process.exit(0);
});

await client.login(token);
