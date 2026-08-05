'use strict';

// Custom status và rich presence.
// Chạy: DISCORD_TOKEN=... node examples/RichPresence.js

const process = require('node:process');
const { ActivityType, Client, CustomStatus, RichPresence, SpotifyRPC } = require('@trickstarcandina/discordjs-selfbot');

const client = new Client({});

client.on('ready', async () => {
  // Custom status kèm emoji. Bot không phát được emoji, tài khoản người dùng thì có.
  const status = new CustomStatus().setState('Đang bận').setEmoji('🔥');
  client.user.setPresence({ activities: [status], status: 'dnd' });

  // Rich presence đầy đủ. Muốn hiện ảnh thì phải có applicationId.
  const presence = new RichPresence()
    .setName('Trò chơi của tôi')
    .setType(ActivityType.Playing)
    .setApplicationId('367827983903490050')
    .setDetails('Đang ở màn 3')
    .setState('Còn 2 mạng')
    .setStartTimestamp(Date.now())
    .setAssetsLargeText('Ảnh lớn')
    .addButton('Trang chủ', 'https://kalix.vn');

  // Ảnh không host trên Discord thì đẩy qua proxy trước.
  const [asset] = await RichPresence.getExternal(client, '367827983903490050', 'https://kalix.vn/anh.png');
  presence.setAssetsLargeImage(asset.external_asset_path);

  client.user.setPresence({ activities: [presence] });

  // Giả lập đang nghe Spotify.
  const spotify = new SpotifyRPC()
    .setSongId('4cOdK2wGLETKBW3PvgPWqT')
    .setAlbumId('6JWc4iAiJ9FjyK0B59ABb4')
    .setArtistIds('1uNFoZAHBGtllmzznpCI3s');
  client.user.setPresence({ activities: [spotify] });

  // Đặt custom status lên chính tài khoản, không chỉ presence của phiên này.
  await client.settings.setCustomStatus({ text: 'Xin chào', emoji: '👋' });
});

client.login(process.env.DISCORD_TOKEN);
