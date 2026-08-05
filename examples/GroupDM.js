'use strict';

// Group DM và cuộc gọi.
// Chạy: DISCORD_TOKEN=... node examples/GroupDM.js

const process = require('node:process');
const { Client } = require('@trickstarcandina/discordjs-selfbot');

const client = new Client({});

client.on('ready', async () => {
  const group = client.channels.cache.get('ID_GROUP_DM');

  // Khác bản partial của bot: tài khoản người dùng gửi tin nhắn được.
  await group.send('Xin chào cả nhóm');

  await group.setName('Tên nhóm mới');
  await group.addUser('ID_NGUOI_DUNG');
  await group.removeUser('ID_NGUOI_DUNG_KHAC');

  // recipients là Collection<Snowflake, User>, không phải mảng thô.
  console.log([...group.recipients.values()].map(user => user.username));

  const invite = await group.createInvite();
  console.log('Link mời:', invite.url);

  // Đổ chuông cho cả nhóm, hoặc chỉ vài người.
  await group.ring();
});

client.on('callCreate', call => {
  console.log(`Cuộc gọi ở ${call.channelId}, vùng ${call.region}`);
  console.log('Đang đổ chuông:', [...call.ringing.keys()]);
});

client.on('channelRecipientAdd', (channel, user) => console.log(`${user.username} vào ${channel.name}`));

client.login(process.env.DISCORD_TOKEN);
