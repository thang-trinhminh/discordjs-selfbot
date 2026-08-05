'use strict';

// Đi qua proxy. Áp cho cả REST lẫn upload file.
// Chạy: DISCORD_TOKEN=... node examples/Proxy.js

const process = require('node:process');
const { Client } = require('@trickstarcandina/discordjs-selfbot');

const client = new Client({
  http: {
    // Chuỗi, hoặc object tuỳ chọn của undici ProxyAgent.
    agent: 'http://user:pass@127.0.0.1:8080',

    // Ghi đè header mặc định nếu cần giả lập máy khác.
    headers: { 'accept-language': 'vi-VN' },
  },
});

client.on('ready', () => console.log(`Đăng nhập với ${client.user.tag}`));
client.login(process.env.DISCORD_TOKEN);
