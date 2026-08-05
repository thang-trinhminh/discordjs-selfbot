'use strict';

// Gọi slash command của bot khác, bấm nút, chọn menu — với tư cách người dùng.
// Chạy: DISCORD_TOKEN=... node examples/SlashCommand.js

const process = require('node:process');
const { Client } = require('@trickstarcandina/discordjs-selfbot');

const client = new Client({});

client.on('ready', async () => {
  const channel = client.channels.cache.get('ID_KENH');

  // Xem bot nào có lệnh gì trong kênh này.
  const { application_commands: commands } = await channel.searchApplicationCommands({ query: 'ping' });
  console.log(commands.map(command => command.name));

  // Gọi lệnh. Giá trị option truyền theo đúng thứ tự Discord khai báo.
  const reply = await channel.sendSlash('ID_BOT', 'ping');
  console.log('Bot trả lời:', reply.content);

  // Lệnh có subcommand group: 'lenh nhom lenhcon'
  await channel.sendSlash('ID_BOT', 'role add user', 'ID_NGUOI_DUNG');

  // Option kiểu attachment: thư viện tự upload file trước rồi tham chiếu tới nó.
  await channel.sendSlash('ID_BOT', 'upload', { name: 'anh.png', attachment: './anh.png' });

  // Bấm nút và chọn menu trên tin nhắn bot vừa gửi.
  await reply.clickButton('id_cua_nut');
  await reply.selectMenu('id_cua_menu', ['Lựa chọn 1']);
});

client.login(process.env.DISCORD_TOKEN);
