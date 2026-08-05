'use strict';

// Đăng nhập bằng cách quét mã QR trên ứng dụng Discord ở điện thoại.
// Chạy: node examples/QRLogin.js

const { Client, RemoteAuth } = require('@trickstarcandina/discordjs-selfbot');

const client = new Client({});

// Cách ngắn: client tự in mã QR rồi đăng nhập khi bạn duyệt.
client.QRLogin().then(token => {
  console.log('Đã lấy được token, độ dài:', token.length);
});

client.on('ready', () => console.log(`Đăng nhập với ${client.user.tag}`));

// Cách dài, nếu cần tự vẽ mã QR hoặc theo dõi từng bước:
async function manual() {
  const auth = new RemoteAuth();

  auth.on('ready', async () => {
    console.log('Quét link này:', auth.qrCodeURL);
    console.log(await auth.generateQR());
  });

  auth.on('pending', user => console.log(`${user.username} đã quét, đang chờ duyệt...`));
  auth.on('cancel', () => console.log('Đã huỷ từ điện thoại'));

  const token = await auth.connect();
  console.log('Token:', token.slice(0, 8) + '...');
}

// manual();
module.exports = { manual };
