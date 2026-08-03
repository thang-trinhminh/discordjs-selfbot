'use strict';

// Đăng nhập bằng token và đọc vài thứ chỉ tài khoản người dùng mới có.
// Chạy: DISCORD_TOKEN=... node examples/Basic.js

const process = require('node:process');
const { Client } = require('discordjs-selfbot-v14');

// Không cần intents: gateway không nhận field đó với tài khoản người dùng.
const client = new Client({});

client.on('ready', async () => {
  console.log(`Đăng nhập với ${client.user.tag}`);
  console.log(`Bạn bè      : ${client.relationships.friendCache.size}`);
  console.log(`Đã chặn     : ${client.relationships.blockedCache.size}`);
  console.log(`Lời mời đến : ${client.relationships.incomingCache.size}`);
  console.log(`Guild       : ${client.guilds.cache.size}`);

  await client.settings.fetch();
  console.log(`Giao diện   : ${client.settings.theme}`);
});

client.on('messageCreate', message => {
  if (message.author.id === client.user.id) console.log(`Tôi vừa gửi: ${message.content}`);
});

client.login(process.env.DISCORD_TOKEN);
