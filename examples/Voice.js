'use strict';

// Vào voice channel, phát audio và video (Go Live).
// Chạy: DISCORD_TOKEN=... node examples/Voice.js
//
// CẢNH BÁO: phần voice được port từ bản v13 và CHƯA được chạy thử lần nào với
// Discord thật. Xem khối cảnh báo trong README.

const process = require('node:process');
const { Client } = require('discordjs-selfbot');

const client = new Client({});

client.on('ready', async () => {
  const channel = client.channels.cache.get('ID_VOICE_CHANNEL');

  const connection = await client.voice.joinChannel(channel, {
    selfMute: false,
    selfDeaf: false,
    selfVideo: false,
  });

  // Phát audio từ file hoặc stream.
  const dispatcher = connection.playAudio('./nhac.mp3');
  dispatcher.on('finish', () => console.log('Phát xong'));

  // Go Live: mở luồng rồi phát video vào đó.
  const stream = await connection.createStream();
  stream.playVideo('./video.mp4');
});

client.on('guildMemberSpeaking', (member, speaking) => {
  if (speaking.bitfield) console.log(`${member.user.username} đang nói`);
});

client.login(process.env.DISCORD_TOKEN);
