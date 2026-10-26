'use strict';

const { Collection } = require('@discordjs/collection');
const { Routes, InviteFlags, GuildVerificationLevel } = require('discord-api-types/v10');
const { resolveInviteCode } = require('../util/DataResolver');
const Events = require('../util/Events');
const { UserRoutes } = require('../util/UserRoutes');

const NITRO_CODE_PATTERN = /(?:discord\.gift|discord(?:app)?\.com\/gifts)\/(\w{16,25})/;
const INVITE_CODE_PATTERN = /^[\w-]{2,255}$/;
const OAUTH2_URL_PATTERN = /^https:\/\/(?:canary\.|ptb\.)?discord\.com(?:\/api(?:\/v\d{1,2})?)?\/oauth2\/authorize\?/;

/**
 * Trả lời hết prompt onboarding của một guild bằng lựa chọn đầu tiên.
 * @param {Client} client Client đã đăng nhập
 * @param {Snowflake} guildId Id của guild
 * @returns {Promise<boolean>} `true` nếu có prompt và đã trả lời
 * @private
 */
async function bypassOnboarding(client, guildId) {
  const onboarding = await client.rest.get(Routes.guildOnboarding(guildId));
  if (!onboarding.enabled) return false;

  const prompts = onboarding.prompts.filter(prompt => prompt.in_onboarding);
  if (!prompts.length) return false;

  const now = Date.now();
  const promptsSeen = {};
  const responsesSeen = {};
  const responses = [];

  for (const prompt of prompts) {
    promptsSeen[prompt.id] = now;
    if (prompt.required) responses.push(prompt.options[0].id);
    for (const option of prompt.options) responsesSeen[option.id] = now;
  }

  await client.rest.post(UserRoutes.guildOnboardingResponses(guildId), {
    body: {
      onboarding_prompts_seen: promptsSeen,
      onboarding_responses: responses,
      onboarding_responses_seen: responsesSeen,
    },
  });
  return true;
}

/**
 * Đồng ý bản quy tắc thành viên của guild.
 * @param {Client} client Client đã đăng nhập
 * @param {Invite} invite Lời mời vừa dùng
 * @returns {Promise<boolean>} `true` nếu đã gửi form
 * @private
 */
async function bypassMemberVerification(client, invite) {
  const guildId = invite.guild.id;
  const { verificationLevel } = invite.guild;

  if (verificationLevel === GuildVerificationLevel.VeryHigh && !client.user.phone) {
    client.emit(Events.Debug, `[Invite > Guild ${guildId}] Cannot bypass verification: phone required`);
    return false;
  }
  if (verificationLevel !== GuildVerificationLevel.None && !client.user.email) {
    client.emit(Events.Debug, `[Invite > Guild ${guildId}] Cannot bypass verification: email required`);
    return false;
  }

  const form = await client.rest
    .get(UserRoutes.guildMemberVerification(guildId), {
      query: new URLSearchParams({ with_guild: 'false', invite_code: invite.code }),
    })
    .catch(() => null);

  if (!form?.form_fields?.[0]) return false;

  await client.rest.put(UserRoutes.guildJoinRequest(guildId), {
    body: { form_fields: [{ ...form.form_fields[0], response: true }], version: form.version },
  });
  client.emit(Events.Debug, `[Invite > Guild ${guildId}] Bypassed member verification`);
  return true;
}

/**
 * Các thao tác chỉ tài khoản người dùng mới làm được, trộn vào `Client.prototype`.
 * @type {Object}
 */
const ClientActions = {
  /**
   * Session id của shard hiện tại. Một số endpoint dành cho user account đòi
   * field này trong body.
   * @type {?string}
   * @readonly
   */
  get sessionId() {
    return this.ws.shards.first()?.sessionInfo?.sessionId ?? null;
  },

  /**
   * @typedef {Object} PassLoginOptions
   * @property {?string} [mfaSecret] Secret 2FA dạng base32, để tự sinh mã khi Discord hỏi
   * @property {?Function} [mfaCode] Hàm bất đồng bộ trả về mã 2FA, dùng khi không có secret
   * @property {boolean} [login=true] Đăng nhập luôn client bằng token lấy được
   */

  /**
   * Đăng nhập bằng email và mật khẩu.
   *
   * <warn>Cách này rủi ro hơn dùng token: Discord soi kỹ đăng nhập bằng mật khẩu
   * và hay chặn bằng captcha. Cấu hình `captchaSolver` trước nếu cần.</warn>
   * @param {string} login Email hoặc số điện thoại
   * @param {string} password Mật khẩu
   * @param {PassLoginOptions} [options={}] Tuỳ chọn
   * @returns {Promise<string>} Token của tài khoản
   */
  async passLogin(login, password, options = {}) {
    const { generateTOTP } = require('../util/totp');
    const { mfaSecret, mfaCode, login: shouldLogin = true } = options;

    const response = await this.rest.post(UserRoutes.authLogin(), {
      body: { login, password, undelete: false, login_source: null, gift_code_sku_id: null },
    });

    let { token } = response;

    if (!token && response.mfa) {
      if (!mfaSecret && !mfaCode) {
        throw new Error('This account has two-factor authentication; pass mfaSecret or mfaCode');
      }

      const code = mfaSecret ? generateTOTP(mfaSecret) : await mfaCode();
      ({ token } = await this.rest.post(UserRoutes.authMfaTotp(), { body: { code, ticket: response.ticket } }));
    }

    if (!token) throw new Error('Discord did not return a token; check the response for a required action');

    if (shouldLogin) await this.login(token);
    return token;
  },

  /**
   * Đăng nhập bằng cách quét mã QR trên ứng dụng Discord ở điện thoại.
   * @param {Object} [options={}] Tuỳ chọn
   * @param {boolean} [options.printQR=true] In mã QR ra terminal
   * @returns {Promise<string>} Token của tài khoản
   */
  async QRLogin({ printQR = true } = {}) {
    const { RemoteAuth } = require('../util/RemoteAuth');
    const auth = new RemoteAuth({ rest: this.rest });

    auth.on('debug', message => this.emit(Events.Debug, `[REMOTE AUTH] ${message}`));
    if (printQR) {
      auth.once('ready', async () => {
        this.emit(Events.Debug, `[REMOTE AUTH] ${auth.qrCodeURL}`);
        // eslint-disable-next-line no-console
        console.log(await auth.generateQR());
      });
    }

    return auth.connect(this);
  },

  /**
   * Đăng xuất khỏi Discord rồi huỷ client.
   * @returns {Promise<void>}
   */
  async logout() {
    await this.rest.post(UserRoutes.authLogout(), { body: { provider: null, voip_provider: null } });
    return this.destroy();
  },

  /**
   * @typedef {Object} AcceptInviteOptions
   * @property {boolean} [bypassOnboarding=true] Tự trả lời màn onboarding
   * @property {boolean} [bypassVerify=true] Tự đồng ý bản quy tắc thành viên
   */

  /**
   * Dùng một lời mời để vào guild hoặc group DM.
   * @param {InviteResolvable} invite Lời mời
   * @param {AcceptInviteOptions} [options={}] Tuỳ chọn
   * @returns {Promise<Guild|GroupDMChannel|null>}
   */
  async acceptInvite(invite, options = {}) {
    const { bypassOnboarding: doOnboarding = true, bypassVerify = true } = options;

    const code = resolveInviteCode(invite);
    // `resolveInviteCode` trả nguyên chuỗi khi không khớp link nào, và `Routes.invite`
    // của upstream ghép thẳng vào path: `../` hay `#` trong đó bẻ request mang token
    // sang endpoint khác. Mã mời thật chỉ gồm chữ, số, `_` và `-`.
    if (typeof code !== 'string' || !INVITE_CODE_PATTERN.test(code)) {
      throw new TypeError('Could not resolve an invite code from the given invite');
    }

    const resolved = await this.fetchInvite(code);

    // Đã ở trong rồi thì khỏi gọi API.
    const cachedGuild = resolved.guild?.id && this.guilds.cache.get(resolved.guild.id);
    if (cachedGuild) return cachedGuild;
    if (this.channels.cache.has(resolved.channelId)) return this.channels.cache.get(resolved.channelId);

    const data = await this.rest.post(Routes.invite(code), { body: { session_id: this.sessionId } });

    if (!resolved.guild?.id) return this.channels.cache.get(resolved.channelId ?? data.channel?.id) ?? null;

    const guildId = resolved.guild.id;
    this.emit(Events.Debug, `[Invite > Guild ${guildId}] Joined`);

    // Guest invite chỉ cho vào một kênh, không có onboarding hay quy tắc.
    if (resolved.flags?.has(InviteFlags.IsGuestInvite)) {
      this.emit(Events.Debug, `[Invite > Guild ${guildId}] Guest invite, skipping onboarding`);
      return this.guilds.cache.get(guildId) ?? null;
    }

    if (doOnboarding && (await bypassOnboarding(this, guildId))) {
      this.emit(Events.Debug, `[Invite > Guild ${guildId}] Bypassed onboarding`);
    }

    if (data.show_verification_form && bypassVerify) {
      await bypassMemberVerification(this, resolved);
    }

    return this.guilds.cache.get(guildId) ?? null;
  },

  /**
   * Nhận một món quà Nitro.
   * @param {string} nitro Link quà hoặc mã quà
   * @param {ChannelResolvable} [channel] Kênh nhận quà
   * @param {Snowflake} [paymentSourceId] Nguồn thanh toán, cần cho quà trả phí
   * @returns {Promise<Object>}
   */
  // Async để lỗi validate cũng reject; ném đồng bộ thì `.catch()` không bắt được.
  async redeemNitro(nitro, channel, paymentSourceId) {
    if (typeof nitro !== 'string') throw new TypeError('Nitro gift must be a string');

    const code = nitro.match(NITRO_CODE_PATTERN)?.[1] ?? nitro;
    return this.rest.post(UserRoutes.redeemGiftCode(code), {
      body: {
        channel_id: channel ? this.channels.resolveId(channel) : null,
        payment_source_id: paymentSourceId ?? null,
      },
    });
  },

  /**
   * Cấp quyền cho một link OAuth2.
   * @param {string} url Link `https://discord.com/oauth2/authorize?...`
   * @param {Object} [options={}] Ghi đè phần body gửi lên
   * @returns {Promise<Object>}
   */
  // Async cùng lý do như `redeemNitro`.
  async authorizeURL(url, options = {}) {
    if (!OAUTH2_URL_PATTERN.test(url)) throw new TypeError(`Not a Discord OAuth2 authorize url: ${url}`);

    const query = new URL(url).searchParams;
    const body = {
      authorize: true,
      permissions: '0',
      integration_type: 0,
      location_context: { guild_id: '10000', channel_id: '10000', channel_type: 10000 },
      ...Object.fromEntries(query),
      ...options,
    };

    // Ba field này thuộc body, để lại trong query sẽ bị Discord từ chối.
    for (const key of ['permissions', 'integration_type', 'guild_id']) query.delete(key);

    return this.rest.post(Routes.oauth2Authorization(), { query, body });
  },

  /**
   * Cài một user app vào tài khoản.
   * @param {Snowflake} applicationId Id của application
   * @returns {Promise<Object|false>} `false` nếu app đó không hỗ trợ cài cho user
   */
  async installUserApps(applicationId) {
    const application = await this.rest.get(UserRoutes.applicationPublic(applicationId), {
      query: new URLSearchParams({ with_guild: 'false' }),
    });

    // Key '1' = user install. Thiếu key này nghĩa là app chỉ cài được vào guild.
    const userInstall = application.integration_types_config?.['1'];
    if (!userInstall) return false;

    return this.rest.post(Routes.oauth2Authorization(), {
      query: new URLSearchParams({
        client_id: applicationId,
        scope: userInstall.oauth2_install_params.scopes.join(' '),
      }),
      body: { permissions: '0', authorize: true, integration_type: 1 },
    });
  },

  /**
   * Thu hồi quyền đã cấp cho một application.
   * @param {Snowflake} id Id của application, hoặc của token khi `type` là `token`
   * @param {string} [type='application'] `application` hoặc `token`
   * @returns {Promise<void>}
   */
  async deauthorize(id, type = 'application') {
    if (type !== 'application') return this.rest.delete(UserRoutes.oauth2Token(id));

    const tokens = await this.rest.get(UserRoutes.oauth2Tokens());
    const token = tokens.find(entry => entry.application.id === id);
    if (!token) throw new Error(`No authorization found for application ${id}`);

    return this.rest.delete(UserRoutes.oauth2Token(token.id));
  },

  /**
   * @typedef {Object} AuthorizedApplication
   * @property {Application} application Application đã được cấp quyền
   * @property {Snowflake} authorizedApplicationId Id của bản cấp quyền
   * @property {string[]} scopes Các scope đã cấp
   * @property {Function} deauthorize Thu hồi quyền này
   */

  /**
   * Liệt kê các application đã được cấp quyền.
   * @returns {Promise<Collection<Snowflake, AuthorizedApplication>>}
   */
  async authorizedApplications() {
    const Application = require('../structures/interfaces/Application');
    const data = await this.rest.get(UserRoutes.oauth2Tokens());

    return new Collection(
      data.map(entry => [
        entry.application.id,
        {
          application: new Application(this, entry.application),
          authorizedApplicationId: entry.id,
          scopes: entry.scopes,
          deauthorize: () => this.deauthorize(entry.id, 'token'),
        },
      ]),
    );
  },

  /**
   * Làm mới link đính kèm đã hết hạn chữ ký.
   * @param {...string} urls Link cần làm mới
   * @returns {Promise<Array<{original: string, refreshed: string}>>}
   */
  async refreshAttachmentURL(...urls) {
    const cleaned = urls.flat().map(url => {
      const parsed = new URL(url);
      // Bỏ chữ ký cũ, nếu không Discord trả lại đúng link đã hết hạn.
      parsed.search = '';
      return parsed.toString();
    });

    const data = await this.rest.post(UserRoutes.refreshAttachmentUrls(), { body: { attachment_urls: cleaned } });
    return data.refreshed_urls;
  },
};

module.exports = ClientActions;
