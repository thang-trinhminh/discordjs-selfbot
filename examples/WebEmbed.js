'use strict';

// Gửi "embed" bằng link unfurl — cách duy nhất tài khoản người dùng đăng được
// embed, vì API không cho user account đính embed thật vào tin nhắn.
// Chạy: DISCORD_TOKEN=... node examples/WebEmbed.js

const process = require('node:process');
const { Client, WebEmbed } = require('discordjs-selfbot');

const client = new Client({});

client.on('ready', async () => {
  const channel = client.channels.cache.get('ID_KENH');

  const embed = new WebEmbed({
    // Endpoint mặc định là dịch vụ bên thứ ba của dự án v13 đã archive; mọi nội
    // dung đi qua máy chủ đó. Tự host rồi truyền vào đây nếu cần chắc chắn.
    baseURL: 'https://webembed-sb.onrender.com/embed',
  })
    .setTitle('Tiêu đề')
    .setDescription('Mô tả, tối đa 350 ký tự')
    .setURL('https://kalix.vn')
    .setColor('#FF0000')
    .setImage('https://kalix.vn/anh.png');

  // hiddenEmbed đẩy link xuống dưới để người đọc chỉ thấy phần embed.
  await channel.send(`${WebEmbed.hiddenEmbed}${embed}`);
});

client.login(process.env.DISCORD_TOKEN);
