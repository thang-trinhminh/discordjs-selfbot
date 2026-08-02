import { expectType, expectAssignable } from 'tsd';
import type { Collection } from '@discordjs/collection';
import {
  BillingManager,
  CallState,
  Client,
  ClientUser,
  ClientUserSettingManager,
  CustomStatus,
  GroupDMChannel,
  GuildBoost,
  RelationshipManager,
  RichPresence,
  Session,
  SessionManager,
  SpotifyRPC,
  UserNoteManager,
  WebEmbed,
  RelationshipType,
  HypeSquadHouse,
} from '.';

// `intents` không còn bắt buộc: đây là điểm chặn đầu tiên với người dùng TypeScript.
const client = new Client({});
expectAssignable<Client>(client);

// Manager riêng của tài khoản người dùng phải nhìn thấy được từ client.
expectType<RelationshipManager>(client.relationships);
expectType<SessionManager>(client.sessions);
expectType<UserNoteManager>(client.notes);
expectType<ClientUserSettingManager>(client.settings);
expectType<BillingManager>(client.billing);
expectType<string | null>(client.sessionId);

// Thao tác trên client.
expectType<Promise<void>>(client.logout());
expectType<Promise<Collection<string, unknown>>>(
  client.authorizedApplications() as unknown as Promise<Collection<string, unknown>>,
);

// Relationship: cache là kiểu quan hệ dạng số, không phải structure.
expectType<Collection<string, number>>(client.relationships.cache);
expectType<Promise<boolean>>(client.relationships.setNickname('1', 'ten'));
expectType<1>(RelationshipType.Friend);
expectType<0>(HypeSquadHouse.Leave);

// Session: tên đúng là lastUsedAt, createdAt chỉ là alias giữ tương thích v13.
declare const session: Session;
expectType<Date>(session.lastUsedAt);
expectType<Date>(session.createdAt);
expectType<Promise<void>>(session.logout());

// Guild settings gắn trên từng guild.
declare const guild: import('.').Guild;
expectType<import('.').GuildSettingManager>(guild.settings);

// Group DM của tài khoản người dùng gửi được tin nhắn; bản partial của upstream thì không.
declare const groupDm: GroupDMChannel;
expectType<Collection<string, import('.').User>>(groupDm.recipients);
expectAssignable<Function>(groupDm.send);
expectAssignable<Function>(groupDm.sendTyping);

// Builder presence.
expectAssignable<Record<string, unknown>>(new CustomStatus().setState('x').setEmoji('🔥').toJSON());
expectAssignable<Record<string, unknown>>(new RichPresence().setName('x').toJSON());
expectAssignable<Record<string, unknown>>(new SpotifyRPC().setSongId('x').toJSON());

// WebEmbed tự host được.
expectType<string>(new WebEmbed({ baseURL: 'https://embed.kalix.vn' }).setTitle('x').toString());

// ClientUser: các field riêng của tài khoản người dùng phải qua được `edit`.
declare const clientUser: ClientUser;
expectType<Promise<ClientUser>>(clientUser.edit({ username: 'a', password: 'b', bio: 'c', pronouns: 'd' }));
expectType<Promise<ClientUser>>(clientUser.setGlobalName('Ten'));
expectType<Promise<number>>(clientUser.fetchBurstCredit());

// Boost.
declare const boost: GuildBoost;
expectType<boolean>(boost.used);
expectType<Promise<GuildBoost>>(boost.subscribe('1'));

// Call.
declare const call: CallState;
expectType<Collection<string, import('.').User | null>>(call.ringing);

// Event riêng của selfbot.
client.on('relationshipAdd', (userId, shouldNotify) => {
  expectType<string>(userId);
  expectType<boolean>(shouldNotify);
});

client.on('channelRecipientAdd', (channel, user) => {
  expectType<GroupDMChannel>(channel);
  expectType<import('.').User>(user);
});

client.on('callCreate', call_ => {
  expectType<CallState>(call_);
});
