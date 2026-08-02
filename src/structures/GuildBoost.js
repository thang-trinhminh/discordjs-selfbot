'use strict';

const Base = require('./Base');
const { UserRoutes } = require('../util/UserRoutes');

/**
 * Một suất boost mà client user đang sở hữu, đã dùng hoặc chưa.
 * @extends {Base}
 */
class GuildBoost extends Base {
  constructor(client, data) {
    super(client);
    this._patch(data);
  }

  _patch(data) {
    if ('id' in data) {
      /**
       * Id của suất boost.
       * @type {Snowflake}
       */
      this.id = data.id;
    }

    if ('subscription_id' in data) {
      /**
       * Id của gói đăng ký sinh ra suất boost này.
       * @type {Snowflake}
       */
      this.subscriptionId = data.subscription_id;
    }

    if ('canceled' in data) {
      /**
       * Gói đăng ký đã bị huỷ chưa.
       * @type {boolean}
       */
      this.canceled = data.canceled;
    }

    if ('cooldown_ends_at' in data) {
      /**
       * Thời điểm hết thời gian chờ, trước đó không chuyển boost sang guild khác được.
       * @type {?Date}
       */
      this.cooldownEndsAt = data.cooldown_ends_at ? new Date(data.cooldown_ends_at) : null;
    }

    if ('premium_guild_subscription' in data) {
      const subscription = data.premium_guild_subscription;

      /**
       * Id bản ghi boost đang gắn với guild, `null` khi suất chưa được dùng.
       * @type {?Snowflake}
       */
      this.premiumGuildSubscriptionId = subscription?.id ?? null;

      /**
       * Guild đang nhận suất boost này, `null` khi chưa dùng.
       * @type {?Snowflake}
       */
      this.guildId = subscription?.guild_id ?? null;

      /**
       * Bản ghi boost đã kết thúc chưa.
       * @type {?boolean}
       */
      this.ended = subscription?.ended ?? null;
    } else {
      this.premiumGuildSubscriptionId ??= null;
      this.guildId ??= null;
      this.ended ??= null;
    }
  }

  /**
   * Guild đang nhận suất boost này.
   * @type {?Guild}
   * @readonly
   */
  get guild() {
    return this.guildId ? (this.client.guilds.cache.get(this.guildId) ?? null) : null;
  }

  /**
   * Suất boost đã được dùng cho guild nào chưa.
   * @type {boolean}
   * @readonly
   */
  get used() {
    return Boolean(this.premiumGuildSubscriptionId);
  }

  /**
   * Dùng suất boost cho một guild.
   * @param {GuildResolvable} guild Guild nhận boost
   * @returns {Promise<GuildBoost>}
   */
  async subscribe(guild) {
    if (this.used) throw new Error(`Boost ${this.id} is already used on guild ${this.guildId}`);

    const guildId = this.client.guilds.resolveId(guild);
    if (!guildId) throw new TypeError('Could not resolve a guild id from the given guild');

    const data = await this.client.rest.put(UserRoutes.guildPremiumSubscriptions(guildId), {
      body: { user_premium_guild_subscription_slot_ids: [this.id] },
    });

    // API trả về mảng bản ghi vừa tạo; lấy bản ghi ứng với suất này.
    const subscription = Array.isArray(data)
      ? data.find(entry => entry.user_premium_guild_subscription_slot_id === this.id)
      : data;
    this._patch({ premium_guild_subscription: subscription ?? null });
    return this;
  }

  /**
   * Rút suất boost khỏi guild đang dùng.
   * @returns {Promise<GuildBoost>}
   */
  async unsubscribe() {
    if (!this.used) throw new Error(`Boost ${this.id} is not used on any guild`);

    await this.client.rest.delete(UserRoutes.guildPremiumSubscription(this.guildId, this.premiumGuildSubscriptionId));

    this._patch({ premium_guild_subscription: null });
    return this;
  }
}

module.exports = GuildBoost;
