// Smoke Tier 3: voice. Toan bo stack nay duoc chep tu ban v13 va CHUA TUNG chay
// that, nen day la lan dau UDP, RTP, bat tay voice gateway va ma hoa duoc kiem
// chung. Khong co gi trong day tra lai duoc bang REST — cach don dep duy nhat la
// roi kenh, va script luon roi kenh o finally.
//
// Chay: SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/voice.mjs
// Khong chay trong CI.
//
// Can chuan bi:
//   SMOKE_VOICE_CHANNEL_ID  voice channel co quyen Connect va Speak
//   ffmpeg                  trong PATH, prism-media goi truc tiep
//   mot module opus         @discordjs/opus hoac opusscript; lib khong bundle
//
// LUU Y: vao voice channel la CA SERVER nhin thay, khac han sandbox group DM kin
// cua bo message. Chon kenh vang.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  console.error('Script nay vao voice channel that, ca server nhin thay. Chay lai voi SMOKE_ALLOW_WRITE=1.');
  process.exit(1);
}

const channelId = process.env.SMOKE_VOICE_CHANNEL_ID;
if (!channelId) {
  console.error('Thieu SMOKE_VOICE_CHANNEL_ID. Dien id mot voice channel co quyen Connect va Speak.');
  process.exit(1);
}

const CALL_DELAY_MS = Number(process.env.SMOKE_WRITE_DELAY_MS ?? 3000);
// Voice bat tay lau hon REST rat nhieu: gateway tra endpoint, roi con dò UDP va
// trao doi khoa. Cho han hoi truoc khi ket luan la hong.
const READY_TIMEOUT_MS = Number(process.env.SMOKE_VOICE_TIMEOUT_MS ?? 20_000);
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
    results.push({ name, status: 'FAIL', detail: `${error.name}: ${error.message}` });
  }
}

// Cho mot event, hoac bao loi ro rang khi het gio — thay vi treo im lang.
function waitFor(emitter, event, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.removeListener(event, onEvent);
      reject(new Error(`het ${ms}ms ma khong thay ${label ?? event}`));
    }, ms);

    const onEvent = value => {
      clearTimeout(timer);
      resolve(value);
    };

    emitter.once(event, onEvent);
  });
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

  // File am thanh im lang, tu sinh: khong keo file cua ai vao test, va cai gi phat
  // ra kenh cung khong lam phien nguoi trong server.
  const workDir = mkdtempSync(join(tmpdir(), 'smoke-voice-'));
  const silence = join(workDir, 'silence.ogg');
  const ffmpeg = spawnSync(
    'ffmpeg',
    ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '3', '-c:a', 'libopus', '-y', silence],
    { encoding: 'utf8' },
  );

  let connection = null;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isVoiceBased()) throw new Error(`${channelId} khong phai voice channel`);
    console.log(`Kenh: ${channel.name} (guild ${channel.guildId ?? 'khong co, day la DM'})\n`);

    await check('voice.joinChannel()', async () => {
      connection = await client.voice.joinChannel(channel, { selfDeaf: true, selfMute: false });
      if (!connection) throw new Error('joinChannel resolve nhung khong tra connection');
      return `status=${connection.status} co channel=${connection.channel?.id === channel.id}`;
    });

    await check('connection.playAudio()', async () => {
      if (!connection) throw new Error('khong vao duoc kenh, xem check joinChannel');
      if (ffmpeg.status !== 0) throw new Skipped(`ffmpeg khong tao duoc file mau: ${ffmpeg.stderr?.slice(-200)}`);

      const dispatcher = connection.playAudio(silence);
      // 'finish' bao het stream; 'start' bao goi RTP dau tien da di.
      await waitFor(dispatcher, 'finish', READY_TIMEOUT_MS, 'dispatcher finish');
      return `phat het 3s im lang, streamTime=${dispatcher.streamTime}ms`;
    });

    await check('connection.createStreamConnection()', async () => {
      if (!connection) throw new Error('khong vao duoc kenh, xem check joinChannel');

      const stream = await connection.createStreamConnection();
      if (!stream) throw new Error('createStreamConnection resolve nhung khong tra gi');
      return `status=${stream.status} khac connection goc=${stream !== connection}`;
    });

    await check('receiver.createStream()', async () => {
      if (!connection) throw new Error('khong vao duoc kenh, xem check joinChannel');

      // Khong ai noi trong kenh nen khong cho du lieu — chi kiem tra dung duoc
      // stream doc mot chieu ma khong no.
      const stream = connection.receiver.createStream(client.user.id, { mode: 'pcm', end: 'manual' });
      const usable = typeof stream?.pipe === 'function';
      stream?.destroy();
      if (!usable) throw new Error('receiver khong tra ve readable stream');
      return 'dung duoc stream doc (khong co ai noi de nhan du lieu)';
    });

    await check('connection.disconnect()', async () => {
      if (!connection) throw new Error('khong vao duoc kenh, xem check joinChannel');

      const left = waitFor(connection, 'disconnect', READY_TIMEOUT_MS, 'su kien disconnect');
      connection.disconnect();
      await left;
      connection = null;
      return 'roi kenh sach';
    });
  } catch (error) {
    results.push({ name: 'dung duoc kenh voice', status: 'FAIL', detail: `${error.name}: ${error.message}` });
  } finally {
    // Roi kenh du giua chung co hong: khong de tai khoan ket lai trong voice.
    if (connection) {
      try {
        connection.disconnect();
        console.log('Da roi voice channel o buoc don dep');
      } catch (error) {
        console.error(`KHONG ROI DUOC voice channel: ${error.message}`);
        console.error('Vao Discord ngat ket noi bang tay.');
      }
    }
    rmSync(workDir, { recursive: true, force: true });
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

  appendResults(LOG_FILE, 'voice', results);
  console.log(`Da ghi ket qua vao ${LOG_FILE.pathname}`);

  client.destroy();
  process.exit(failed.length ? 1 : 0);
});

await client.login(token);
