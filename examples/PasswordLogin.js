'use strict';

// Đăng nhập bằng email và mật khẩu, kèm 2FA.
// Chạy: DISCORD_EMAIL=... DISCORD_PASSWORD=... DISCORD_MFA_SECRET=... node examples/PasswordLogin.js
//
// Cách này rủi ro hơn dùng token: Discord soi kỹ đăng nhập bằng mật khẩu và hay
// chặn bằng captcha. Cấu hình captchaSolver trước nếu tài khoản hay bị hỏi.

const process = require('node:process');
const { Client } = require('discordjs-selfbot-v14');

const client = new Client({
  // Nhận object mô tả captcha, trả về chuỗi lời giải.
  captchaSolver: async captcha => {
    console.log('Cần giải captcha, sitekey:', captcha.captcha_sitekey);
    throw new Error('Nối dịch vụ giải captcha của bạn vào đây');
  },
});

client.on('ready', () => console.log(`Đăng nhập với ${client.user.tag}`));

client.passLogin(process.env.DISCORD_EMAIL, process.env.DISCORD_PASSWORD, {
  // Secret base32 lấy lúc bật 2FA. Thư viện tự sinh mã theo RFC 6238.
  mfaSecret: process.env.DISCORD_MFA_SECRET,

  // Hoặc tự nhập mã, khi không giữ secret:
  // mfaCode: async () => '123456',
});
