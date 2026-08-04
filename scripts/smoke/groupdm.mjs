// Smoke Tier 3: phan group DM can nguoi thu hai. Tu dung mot group DM rong, keo
// account thu 2 vao, chay het check, roi xoa han kenh.
// Chay: SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/groupdm.mjs
// Khong chay trong CI.
//
// Can chuan bi:
//   SMOKE_SECOND_USER_ID  id account thu 2, hoac dan link profile
//
// Account thu 2 phai la BAN BE cua account chinh: `PUT /channels/:id/recipients/:id`
// them thang vao nhom, va Discord chi cho lam voi ban be. Khong phai ban be thi
// check do fail vi moi truong chu khong phai vi thu vien.
//
// LUU Y: account kia se thay mot group DM hien len roi bien mat, va nghe do
// chuong vai giay.
//
// `setOwner` / `edit({ owner })` CO TINH khong nam trong day: nhuong quyen chu
// nhom xong thi khong lay lai duoc, va buoc don dep se chi lam minh roi kenh —
// group DM se nam lai vinh vien tren account thu 2. Muon test thi chay tay.
import { createRequire } from 'node:module';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';
import { appendResults } from './log.mjs';

const require = createRequire(import.meta.url);
const { Client, Events } = require('../../src/index.js');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Thieu bien moi truong DISCORD_TOKEN');
  process.exit(1);
}

if (process.env.SMOKE_ALLOW_WRITE !== '1') {
  console.error('Script nay keo mot tai khoan that vao group DM va do chuong. Chay lai voi SMOKE_ALLOW_WRITE=1.');
  process.exit(1);
}

/**
 * Nhan id tran hoac link `discord.com/users/<id>`.
 * @param {?string} value Gia tri trong bien moi truong
 * @returns {?string}
 */
function resolveUserId(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{17,20}$/.test(trimmed)) return trimmed;
  return trimmed.match(/users\/(\d{17,20})/)?.[1] ?? null;
}

const secondUserId = resolveUserId(process.env.SMOKE_SECOND_USER_ID);
if (!secondUserId) {
  console.error('SMOKE_SECOND_USER_ID phai la id user hoac link discord.com/users/...');
  process.exit(1);
}

const CALL_DELAY_MS = Number(process.env.SMOKE_WRITE_DELAY_MS ?? 3000);
const EVENT_TIMEOUT_MS = Number(process.env.SMOKE_EVENT_TIMEOUT_MS ?? 10_000);
const LOG_FILE = new URL('results.md', import.meta.url);

const client = new Client({});
const results = [];

class Skipped extends Error {
  name = 'Skipped';
}

const step = async fn => {
  await sleep(CALL_DELAY_MS);
  return fn();
};

async function check(name, fn) {
  try {
    results.push({ name, status: 'PASS', detail: (await step(fn)) ?? 'ok' });
  } catch (error) {
    const code = error.code ? ` (code ${error.code})` : '';
    results.push({ name, status: 'FAIL', detail: `${error.name}: ${error.message}${code}` });
  }
}

// Gom event de check sau: chung den bat dong bo voi cac loi goi REST.
const seenEvents = new Map();
const record = name => value => seenEvents.set(name, value);

const waitForEvent = async (name, ms) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (seenEvents.has(name)) return seenEvents.get(name);
    await sleep(250);
  }
  return null;
};

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
  console.log(`Dang nhap: ${client.user.tag} (${client.user.id})`);
  console.log(`Account thu 2: ${secondUserId}\n`);

  client.on(Events.ChannelRecipientAdd, record('recipientAdd'));
  client.on(Events.ChannelRecipientRemove, record('recipientRemove'));
  client.on(Events.CallCreate, record('callCreate'));
  client.on(Events.CallUpdate, record('callUpdate'));
  client.on(Events.CallDelete, record('callDelete'));

  let sandboxId = null;
  let added = false;

  try {
    const created = await client.rest.post('/users/@me/channels', { body: { recipients: [] } });
    sandboxId = created.id;
    const channel = await client.channels.fetch(sandboxId);
    console.log(`Sandbox: group DM ${sandboxId}\n`);

    await check('channel.addUser()', async () => {
      await channel.addUser(secondUserId);
      added = true;

      const event = await waitForEvent('recipientAdd', EVENT_TIMEOUT_MS);
      const fetched = await client.channels.fetch(sandboxId, { force: true });
      if (!fetched.recipients.has(secondUserId)) throw new Error('doc lai khong thay nguoi vua them');
      return `recipients=${fetched.recipients.size} event=${Boolean(event)}`;
    });

    await check('channel.fetchOwner()', async () => {
      const owner = await channel.fetchOwner();
      if (owner.id !== client.user.id) throw new Error(`chu nhom la ${owner.id}, mong ${client.user.id}`);
      return 'chu nhom la chinh minh';
    });

    await check('mo cuoc goi bang voice state update + callCreate', async () => {
      if (!added) throw new Skipped('chua keo duoc ai vao nhom');

      // `ring()` mot minh khong tao duoc cuoc goi: khong co cuoc goi nao dang song
      // thi Discord tra `{}` va im lang. Cuoc goi sinh ra khi minh gui voice state
      // update vao kenh, dung thu client that lam khi bam nut goi. Thu vien khong
      // co method rieng cho viec nay.
      client.ws.shards
        .first()
        .send({ op: 4, d: { guild_id: null, channel_id: sandboxId, self_mute: true, self_deaf: true } });

      const call = await waitForEvent('callCreate', EVENT_TIMEOUT_MS);
      if (!call) throw new Error('gui voice state update xong khong thay callCreate');
      if (call.channelId !== sandboxId) throw new Error(`callState tro toi ${call.channelId}`);
      return `region=${call.region ?? '?'} dang do chuong=${call.ringing.size}`;
    });

    await check('channel.ring() + callUpdate', async () => {
      if (!seenEvents.has('callCreate')) throw new Skipped('khong co cuoc goi nao dang song');

      await channel.ring([secondUserId]);
      const call = await waitForEvent('callUpdate', EVENT_TIMEOUT_MS);
      if (!call) throw new Error('do chuong xong khong thay callUpdate');
      if (!call.ringing.has(secondUserId)) throw new Error('danh sach do chuong khong co nguoi thu 2');
      return `dang do chuong=${call.ringing.size}`;
    });

    await check('CallState.setRTCRegion()', async () => {
      const call = seenEvents.get('callCreate');
      if (!call) throw new Skipped('khong co cuoc goi nao dang song');

      const region = call.region === 'singapore' ? 'japan' : 'singapore';
      await call.setRTCRegion(region);
      return `doi region sang ${region}`;
    });

    await check('user.stopRinging()', async () => {
      if (!seenEvents.has('callCreate')) throw new Skipped('khong co cuoc goi nao dang song');

      await client.user.stopRinging(sandboxId);
      return 'ngung do chuong';
    });

    await check('roi cuoc goi + callDelete', async () => {
      if (!seenEvents.has('callCreate')) throw new Skipped('khong co cuoc goi nao dang song');

      client.ws.shards
        .first()
        .send({ op: 4, d: { guild_id: null, channel_id: null, self_mute: false, self_deaf: false } });
      const call = await waitForEvent('callDelete', EVENT_TIMEOUT_MS);
      if (!call) throw new Error('roi cuoc goi xong khong thay callDelete');
      return 'nhan duoc callDelete';
    });

    await check('channel.removeUser()', async () => {
      if (!added) throw new Skipped('chua keo duoc ai vao nhom');

      await channel.removeUser(secondUserId);
      const event = await waitForEvent('recipientRemove', EVENT_TIMEOUT_MS);
      const fetched = await client.channels.fetch(sandboxId, { force: true });
      if (fetched.recipients.has(secondUserId)) throw new Error('doc lai van thay nguoi vua bo');
      return `recipients=${fetched.recipients.size} event=${Boolean(event)}`;
    });
  } catch (error) {
    results.push({ name: 'dung duoc sandbox group DM', status: 'FAIL', detail: `${error.name}: ${error.message}` });
  } finally {
    if (sandboxId) {
      try {
        await sleep(CALL_DELAY_MS);
        await client.rest.delete(`/channels/${sandboxId}`);
        console.log(`\nDa xoa sandbox ${sandboxId}`);
      } catch (error) {
        console.error(`KHONG XOA DUOC sandbox ${sandboxId}: ${error.message}`);
        console.error('Vao Discord xoa tay group DM nay.');
      }
    }
  }

  for (const result of results) {
    if (result.detail.startsWith('Skipped: ')) {
      result.status = 'SKIP';
      result.detail = result.detail.slice('Skipped: '.length);
    }
  }

  const failed = results.filter(result => result.status === 'FAIL');
  const passed = results.filter(result => result.status === 'PASS').length;

  console.log(results.map(result => `${result.status.padEnd(4)} ${result.name} — ${result.detail}`).join('\n'));
  console.log(`tong: ${passed}/${results.length} pass`);

  appendResults(LOG_FILE, 'groupdm', results);
  console.log(`Da ghi ket qua vao ${LOG_FILE.pathname}`);

  client.destroy();
  process.exit(failed.length ? 1 : 0);
});

await client.login(token);
