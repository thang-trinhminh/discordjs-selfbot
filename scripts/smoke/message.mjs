// Smoke Tier 2.5: vong doi tin nhan that. Tu tao mot group DM rong lam sandbox,
// chay het check trong do, roi xoa han kenh. Khong ai khac nhin thay gi.
// Chay: SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/message.mjs
// Khong chay trong CI.
//
// Vi sao la group DM rong: `POST /users/@me/channels` voi `recipients: []` tao
// mot group DM chi minh la thanh vien, va `DELETE /channels/:id` xoa sach ca
// kenh lan tin nhan. DM voi chinh minh thi Discord tra 400, khong dung duoc.
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';
import { appendResults } from './log.mjs';

const require = createRequire(import.meta.url);
const { Client, WebEmbed } = require('../../src/index.js');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Thieu bien moi truong DISCORD_TOKEN');
  process.exit(1);
}

if (process.env.SMOKE_ALLOW_WRITE !== '1') {
  console.error('Script nay gui tin nhan that. Chay lai voi SMOKE_ALLOW_WRITE=1 neu that su muon.');
  process.exit(1);
}

const CALL_DELAY_MS = Number(process.env.SMOKE_WRITE_DELAY_MS ?? 3000);
const LOG_FILE = new URL('results.md', import.meta.url);
const MARKER = `smoke-${Date.now().toString(36)}`;

const client = new Client({});
const results = [];

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

// Danh cho check khong chay duoc vi thieu dieu kien ben ngoai, khong phai vi hong.
class Skipped extends Error {
  name = 'Skipped';
}
const skip = reason => {
  throw new Skipped(reason);
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
  console.log(`Marker cua lan chay nay: ${MARKER}\n`);

  let sandboxId = null;
  try {
    const created = await client.rest.post('/users/@me/channels', { body: { recipients: [] } });
    sandboxId = created.id;
    const channel = await client.channels.fetch(sandboxId);
    console.log(`Sandbox: group DM ${sandboxId} (${channel.recipients.size} nguoi khac)\n`);

    await check('channel.send()', async () => {
      const message = await channel.send(`${MARKER} xin chao`);
      if (!message.id) throw new Error('khong co message id trong ket qua tra ve');
      if (message.content !== `${MARKER} xin chao`) throw new Error(`content lech: ${message.content}`);
      return `id=${Boolean(message.id)} content khop`;
    });

    // Doc lai tu API chu khong tin object vua tra ve.
    const sent = await channel.send(`${MARKER} de doc lai`);

    await check('messages.fetch()', async () => {
      const fetched = await channel.messages.fetch({ message: sent.id, force: true });
      if (fetched.content !== sent.content) throw new Error(`content lech: ${fetched.content}`);
      return `author la minh=${fetched.author.id === client.user.id}`;
    });

    await check('message.edit()', async () => {
      await sent.edit(`${MARKER} da sua`);
      const fetched = await channel.messages.fetch({ message: sent.id, force: true });
      if (fetched.content !== `${MARKER} da sua`) throw new Error(`content sau edit lech: ${fetched.content}`);
      return `editedAt=${Boolean(fetched.editedTimestamp)}`;
    });

    await check('message.reply()', async () => {
      const reply = await sent.reply(`${MARKER} tra loi`);
      if (reply.reference?.messageId !== sent.id) throw new Error('reference khong tro ve tin goc');
      return 'reference dung tin goc';
    });

    await check('message.react() + go reaction', async () => {
      await sent.react('🔥');
      const fetched = await channel.messages.fetch({ message: sent.id, force: true });
      const reaction = fetched.reactions.cache.get('🔥');
      if (!reaction) throw new Error('fetch lai khong thay reaction');

      await sleep(CALL_DELAY_MS);
      await reaction.users.remove(client.user.id);

      // Bo ban cache truoc khi doc lai: Discord khong gui field `reactions` khi
      // khong con reaction nao, ma `Message#_patch` chi cap nhat khi field co
      // mat — doc lai vao ban cu se van thay reaction da bi go.
      channel.messages.cache.delete(sent.id);
      const after = await channel.messages.fetch({ message: sent.id, force: true });
      if (after.reactions.cache.size !== 0) throw new Error(`go reaction xong van con ${after.reactions.cache.size}`);
      return `dat duoc=${reaction.count} go xong con=0`;
    });

    await check('channel.sendTyping()', async () => {
      await channel.sendTyping();
      return 'khong loi';
    });

    await check('message.pin() + unpin()', async () => {
      await sent.pin();
      await sleep(CALL_DELAY_MS);
      const pinned = await channel.messages.fetchPins();
      const found = pinned.items.some(item => item.message.id === sent.id);

      await sleep(CALL_DELAY_MS);
      await sent.unpin();
      const after = await channel.messages.fetchPins();
      if (!found) throw new Error('pin xong nhung khong co trong danh sach ghim');
      return `ghim=${found} sau khi bo ghim con=${after.items.length}`;
    });

    await check('send kem file dinh kem', async () => {
      const message = await channel.send({
        content: `${MARKER} co file`,
        files: [{ attachment: Buffer.from(`${MARKER}\n`, 'utf8'), name: 'smoke.txt' }],
      });

      const fetched = await channel.messages.fetch({ message: message.id, force: true });
      const attachment = fetched.attachments.first();
      if (!attachment) throw new Error('fetch lai khong thay file dinh kem');
      if (attachment.name !== 'smoke.txt') throw new Error(`ten file lech: ${attachment.name}`);
      return `ten khop size=${attachment.size}b`;
    });

    await check('awaitMessages()', async () => {
      // Bat dau cho truoc khi gui: tin cua chinh minh cung ve qua MESSAGE_CREATE.
      const waiting = channel.awaitMessages({ max: 1, time: 15_000 });
      await sleep(500);
      await channel.send(`${MARKER} cho collector`);

      const collected = await waiting;
      if (collected.size !== 1) throw new Error(`collector nhan ${collected.size} tin, mong 1`);
      return 'collector nhan dung tin vua gui';
    });

    await check('WebEmbed link duoc Discord unfurl', async () => {
      // Check nay day title qua dich vu render ben thu ba trong WebEmbed.baseURL.
      // Chi gui moi chuoi marker, khong gui gi cua tai khoan.
      if (process.env.SMOKE_SKIP_WEBEMBED === '1') skip('tat bang SMOKE_SKIP_WEBEMBED');

      const embed = new WebEmbed().setTitle(MARKER).setDescription('smoke test');
      const message = await channel.send(`${WebEmbed.hiddenEmbed}${embed}`);

      // Discord unfurl link khong dong bo, doi roi doc lai.
      await sleep(8000);
      const fetched = await channel.messages.fetch({ message: message.id, force: true });
      if (fetched.embeds.length === 0) {
        skip('Discord chua unfurl link — dich vu render ben thu ba co the dang chet');
      }
      return `embed=${fetched.embeds.length} title=${fetched.embeds[0].title === MARKER}`;
    });

    await check('message.delete()', async () => {
      const doomed = await channel.send(`${MARKER} sap bi xoa`);
      await sleep(CALL_DELAY_MS);
      await doomed.delete();

      await sleep(CALL_DELAY_MS);
      try {
        await channel.messages.fetch({ message: doomed.id, force: true });
      } catch (error) {
        // 10008 Unknown Message la dung. Ma khac nghia la fetch hong vi ly do
        // khac va check nay khong chung minh duoc gi.
        if (error.code !== 10008) throw error;
        return 'fetch lai bao 10008 Unknown Message';
      }
      throw new Error('xoa xong nhung van fetch lai duoc');
    });
  } catch (error) {
    results.push({ name: 'dung sandbox group DM', status: 'FAIL', detail: `${error.name}: ${error.message}` });
  } finally {
    // Xoa kenh la xoa sach moi tin nhan o tren, ke ca khi giua chung co check hong.
    if (sandboxId) {
      try {
        await sleep(CALL_DELAY_MS);
        await client.rest.delete(`/channels/${sandboxId}`);
        console.log(`Da xoa sandbox ${sandboxId}\n`);
      } catch (error) {
        console.error(`KHONG XOA DUOC sandbox ${sandboxId}: ${error.message}`);
        console.error('Vao Discord xoa tay group DM nay.');
      }
    }
  }

  // Skipped duoc nem tu trong check nen den day moi phan loai lai duoc.
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

  appendResults(LOG_FILE, 'message', results);
  console.log(`Da ghi ket qua vao ${LOG_FILE.pathname}`);

  client.destroy();
  process.exit(failed.length ? 1 : 0);
});

await client.login(token);
