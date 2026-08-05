// Smoke Tier 3: gui interaction nhu mot user. Chay slash command cua bot khac,
// bam nut, chon select menu.
// Chay: SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/interaction.mjs
// Khong chay trong CI.
//
// Can chuan bi:
//   SMOKE_INTERACTION_CHANNEL_ID  id kenh, hoac dan thang link discord.com/channels/...
//   SMOKE_INTERACTION_COMMAND     tuy chon, ghim mot lenh cu the thay vi de tu chon
//
// LUU Y: khac sandbox group DM kin, day la kenh that. Ca server thay ban chay
// lenh, va **khong xoa duoc**: Discord khong cho thu hoi mot lan goi interaction,
// cau tra loi lai la tin nhan cua bot. Chon kenh bot-spam.
import { createRequire } from 'node:module';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';
import { appendResults } from './log.mjs';

const require = createRequire(import.meta.url);
const { Client } = require('../../src/index.js');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Thieu bien moi truong DISCORD_TOKEN');
  process.exit(1);
}

if (process.env.SMOKE_ALLOW_WRITE !== '1') {
  console.error('Script nay chay lenh that trong kenh that. Chay lai voi SMOKE_ALLOW_WRITE=1.');
  process.exit(1);
}

/**
 * Nhan ca id tran lan link `discord.com/channels/<guild>/<channel>` — dan link tu
 * Discord ra la tien nhat, khoi phai bat nguoi dung di tim id.
 * @param {?string} value Gia tri trong bien moi truong
 * @returns {?string}
 */
function resolveChannelId(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{17,20}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/channels\/(?:\d+|@me)\/(\d{17,20})/);
  return match?.[1] ?? null;
}

const channelId = resolveChannelId(process.env.SMOKE_INTERACTION_CHANNEL_ID);
if (!channelId) {
  console.error('SMOKE_INTERACTION_CHANNEL_ID phai la id kenh hoac link discord.com/channels/...');
  process.exit(1);
}

const CALL_DELAY_MS = Number(process.env.SMOKE_WRITE_DELAY_MS ?? 3000);
// Bot tra loi qua gateway chu khong phai qua response cua request, va co bot cham.
const REPLY_TIMEOUT_MS = Number(process.env.SMOKE_INTERACTION_TIMEOUT_MS ?? 15_000);
const LOG_FILE = new URL('results.md', import.meta.url);

// Uu tien lenh khong doi tham so va gan nhu chac chan vo hai.
const HARMLESS = ['ping', 'help', 'about', 'info', 'stats', 'invite', 'uptime', 'version'];

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
    results.push({ name, status: 'FAIL', detail: `${error.name}: ${error.message}` });
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
  console.log(`Dang nhap: ${client.user.tag} (${client.user.id})`);

  let command = null;
  let reply = null;

  try {
    const channel = await client.channels.fetch(channelId);
    if (typeof channel?.sendSlash !== 'function') throw new Error(`${channelId} khong phai kenh gui lenh duoc`);
    console.log(`Kenh: ${channel.name ?? channelId} (guild ${channel.guildId ?? 'DM'})\n`);

    await check('searchApplicationCommands() liet ke lenh that', async () => {
      const data = await channel.searchApplicationCommands({ limit: 25 });
      const commands = data.application_commands ?? [];
      if (commands.length === 0) throw new Skipped('kenh nay khong co lenh nao dung duoc');

      const wanted = process.env.SMOKE_INTERACTION_COMMAND?.trim();
      command = wanted
        ? commands.find(item => item.name === wanted)
        : // Khong co tham so bat buoc va ten nam trong danh sach vo hai.
          commands.find(item => HARMLESS.includes(item.name) && !(item.options ?? []).some(option => option.required));

      if (!command) {
        throw new Skipped(
          wanted
            ? `khong thay lenh "${wanted}" trong kenh`
            : `${commands.length} lenh nhung khong cai nao chac chan vo hai, dat SMOKE_INTERACTION_COMMAND de chon`,
        );
      }

      return `lenh=${commands.length} app=${data.applications?.length ?? 0} chon="${command.name}"`;
    });

    await check('channel.sendSlash()', async () => {
      if (!command) throw new Skipped('chua chon duoc lenh nao');

      reply = await channel.sendSlash(command.application_id, command.name);
      if (!reply?.id) throw new Error('sendSlash tra ve nhung khong co tin tra loi');
      if (reply.author.id !== command.application_id) {
        throw new Error(`tra loi tu ${reply.author.id}, mong ${command.application_id}`);
      }
      return `bot tra loi, co noi dung=${Boolean(reply.content || reply.embeds.length)}`;
    });

    await check('message.clickButton()', async () => {
      if (!reply) throw new Skipped('chua co tin tra loi de bam');

      // Nut link khong co custom_id nen bam qua API duoc — bo qua chung.
      const button = reply.components
        .flatMap(row => row.components ?? [])
        .find(item => item.type === 2 && item.customId && !item.disabled);
      if (!button) throw new Skipped('tin tra loi khong co nut bam duoc');

      const after = await reply.clickButton(button.customId, REPLY_TIMEOUT_MS);
      return `bam "${button.customId}", bot phan hoi=${Boolean(after)}`;
    });

    await check('message.selectMenu()', async () => {
      if (!reply) throw new Skipped('chua co tin tra loi de chon');

      const menu = reply.components
        .flatMap(row => row.components ?? [])
        .find(item => item.type === 3 && item.customId && !item.disabled);
      if (!menu) throw new Skipped('tin tra loi khong co select menu');

      const [option] = menu.options ?? [];
      if (!option) throw new Skipped('select menu khong co lua chon nao');

      const after = await reply.selectMenu(menu.customId, [option.value], REPLY_TIMEOUT_MS);
      return `chon "${option.value}", bot phan hoi=${Boolean(after)}`;
    });
  } catch (error) {
    results.push({ name: 'dung duoc kenh gui lenh', status: 'FAIL', detail: `${error.name}: ${error.message}` });
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

  appendResults(LOG_FILE, 'interaction', results);
  console.log(`Da ghi ket qua vao ${LOG_FILE.pathname}`);

  client.destroy();
  process.exit(failed.length ? 1 : 0);
});

await client.login(token);
