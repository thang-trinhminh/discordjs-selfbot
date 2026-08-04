# Smoke test results

Run by hand against a real token, never in CI. This file records **check names,
dates and pass/fail only** — return values (account tag, guild count, friend
count, settings) stay on the console and are not written down.

Times are UTC. One table, one row per check, grouped by suite, with a tally at the
top. Re-running a suite replaces every row it owns, so the table always shows the
latest state rather than growing a block per run — and a check that gets renamed
does not leave a ghost behind.

## What earlier runs found

`login.mjs` ran twice on 2026-08-03. The first failed and the second passed once
patched; that script does not log itself. Two bugs came out of it, each fixed with
an offline test:

- `READY.js` — `user_guild_settings` arrives as `{ version, partial, entries }`,
  not an array.
- `UserManager.js` — `GET /users/:id` is bot-only; a user token gets 403 code 40001.

The 2026-08-04 runs added the eight read-only checks of tier 1b and found:

- `user.fetchBurstCredit()` — `GET /users/@me/burst-credits` answered `404` on a
  live account. A direct probe outside the client got the same bare `404 code 0` on
  API v9 and v10, while `/users/@me/premium-usage` on the same token answered a
  typed `10084` and `/users/@me/billing/country-code` answered `200`. So the token
  was fine and the route is simply gone. The method, its route, its typing and its
  offline test were deleted, which is why it no longer appears below.
- `channel.searchApplicationCommands()` — failed `50013` at first because the check
  grabbed whatever channel came first in the cache. The route is fine; the check now
  prefers a DM and reads `50013` as "route reachable, channel blocks the
  permission". It then failed a second way: `permissionsFor()` returns `null` while
  the self member is uncached, which excluded every channel.
- The other six passed on the first try.

The tier 2 write runs on the same day found two more, both in the library rather
than in the checks:

- **Every request went out with a bot `User-Agent`.** `@discordjs/rest` appends its
  own `User-Agent: DiscordBot (…)` after the headers it is given, and that key
  differs in case from the lowercase `user-agent` the selfbot shim sets, so both
  were sent and Discord read the last one. Most routes did not care;
  `POST /users/@me/invites` answered `204` with an empty body instead of creating
  an invite. Proven by sending the same request twice by hand: browser UA gave
  `200` plus an invite, bot UA gave `204`. `rewriteUserAgent()` now collapses them.
- **`Invite` could not represent a friend invite.** They carry `channel: null`, and
  upstream `_patch` reads `data.channel.id` straight, so building one threw
  `TypeError: Cannot read properties of null`. Tier 1b missed it because the account
  had zero invites, so no `Invite` was ever constructed. The offline test used a
  hand-made `{ code }` payload with no `channel` key at all and missed it the same
  way; it now uses the real shape.

Tier 2.5 sent real messages for the first time, in a throwaway empty group DM, and
found one more:

- **A user token cannot fetch a single message.**
  `GET /channels/:id/messages/:messageId` answers `403 code 20002`, "Only bots can
  use this endpoint", while the list route with `around=<id>&limit=1` answers `200`
  with that exact message. Six of the eleven checks failed on it at once, because
  every one of them verified its work by reading the message back.
  `MessageManager#_fetchSingle` now goes through the list route and still throws a
  `10008` `DiscordAPIError` when the message is gone, so callers that catch that
  code keep working. The `message.delete()` check had been passing for the wrong
  reason — it treated any fetch error as proof of deletion, and 20002 is not that.

Tier 2.6 widened all three suites — group DM management on the sandbox, restricted
guilds, per-guild notification settings, `RichPresence.getExternal`, fetching
another user, and asserting that gateway packets really arrive. Two more findings:

- **Any `CHANNEL_UPDATE` for a group DM killed the client.** `GroupDMChannel`
  installed `recipients` as a read-only accessor directly on the instance, and
  `Base#_clone()` runs `Object.assign(Object.create(this), this)`, so the clone
  inherited that accessor and the copy threw
  `TypeError: Cannot set property recipients`. It surfaced the moment the suite
  renamed its sandbox, and it was not a failed check — the process died inside the
  packet handler. Renaming a group DM from any client, not just this one, would
  have done it. `recipients` is now a getter/setter pair on the prototype, with the
  setter there only to absorb the upstream constructor's assignment, and `toJSON`
  names it explicitly since `flatten` only walks own enumerable properties.
- **Account settings no longer arrive over the gateway.** Discord sends
  `USER_SETTINGS_PROTO_UPDATE`, a protobuf payload; the fork only handles the old
  JSON `USER_SETTINGS_UPDATE`, which never fires. Guild settings, notes and
  relationships all still push fine. The practical effect is that `client.settings`
  goes stale when something changes it elsewhere — `fetch()` and `edit()` are the
  only ways to refresh it. Decoding protobuf is out of scope, so this is recorded
  rather than fixed.

Tier 3 reached voice, the one area copied wholesale from v13 and never run. It
still does not work, but the reasons are now four deep instead of one, and every
layer that was ours has been fixed:

- **A user account could never join a guild voice channel.** `joinChannel` gates on
  `channel.joinable`, which asks `guild.members.me` for permissions — and a user
  token's `READY` never seeds the client's own member, so the member cache is empty,
  `members.me` is `null`, and `joinable` is `false` for every channel. Measured on a
  real guild: `joinable false`, `viewable false`, `permissionsFor(user) null`, and
  after one `guild.members.fetch(self)` the same channel reports `joinable true`.
  `joinChannel` now loads that member first.
- **The voice websocket retried failures that can never succeed.** `onClose`
  reconnected on any close code, five times, then emitted the give-up as `debug` —
  which no one listens to — so the caller sat until a 15s `VOICE_CONNECTION_TIMEOUT`
  and learned nothing about the cause. Fatal codes (4004, 4006, 4017) now raise the
  real reason immediately; 4014, being a normal "you were disconnected", just stops
  the retries without throwing at applications that never registered an error
  handler.
- **`4017 E2EE/DAVE protocol required` was real, and is now gone.** Discord has
  required end-to-end encryption on every non-stage voice call since March 2026.
  IDENTIFY never carried `max_dave_protocol_version`, so the voice server closed the
  socket the moment it read the payload — on gateway versions 8, 7, 6, 5 and 4, each
  probed with a freshly minted session. The fix wraps `@snazzah/davey`, the same
  native MLS binding `@discordjs/voice` uses, in `networking/DAVESession.js`: the
  websocket now speaks DAVE's binary frames, the connection drives the epoch and
  transition handshake, and audio is encrypted inside the existing transport
  encryption rather than instead of it. `@snazzah/davey` is an `optionalDependency`;
  without it `joinChannel` throws a sentence naming the package instead of letting
  the caller discover 4017 for themselves.
- **IDENTIFY was missing `channel_id`, and the manager listened to strangers.**
  Discord requires `channel_id` from gateway v9 and every real client sends it
  regardless. Worse, `ClientVoiceManager#onVoiceStateUpdate` acted on every
  `VOICE_STATE_UPDATE` in the channel, not only the client's own: someone else
  leaving ran `_disconnect()` on our connection, and someone else joining overwrote
  our `sessionId` with theirs. Both are fixed.
- **The wall now is `4006 Session is no longer valid`, and it is not ours.** Every
  field the library controls was verified against a live gateway: `server_id` is the
  guild, `channel_id` the voice channel, `user_id` the account, `token` comes from
  the `VOICE_SERVER_UPDATE` of that same run, and `session_id` matches the shard's
  own `sessionInfo.sessionId` byte for byte — measured, not assumed. Only one
  `VOICE_STATE_UPDATE` arrives and it belongs to this account. Restoring the old
  `streams`/`video` payload changes nothing, so the IDENTIFY split is not the cause
  either. Discord answers 4006 anyway, from a Hong Kong endpoint
  and hands back an identical voice token across separate logins. This matches the
  open, undocumented 4006 reports against user accounts elsewhere
  ([discord.py-self#870](https://github.com/dolfies/discord.py-self/issues/870),
  [discord.py#10207](https://github.com/Rapptz/discord.py/issues/10207)). All five
  voice checks stay `FAIL`, not `SKIP`: voice still does not work against today's
  Discord, and a softer word would read as "we did not get around to it".
- **4006 follows the voice server, not the region.** `rtcRegion` was forced to
  `singapore` (`c-sin12`), `japan` (`c-nrt05`, `c-nrt07`, `c-nrt08`, `c-nrt10`,
  `c-nrt12`), `us-east` (`c-iad22`) and `rotterdam` (`c-ams01`), and set back to
  `auto` afterwards. Nearly all answered 4006. Exactly one — a `c-nrt12` box in
  Japan — did not: it took the IDENTIFY, sent READY and SESSION_DESCRIPTION with a
  DAVE protocol version, and began the MLS handshake. So the stack does work when it
  lands on a voice server willing to talk; which server you are handed is luck.
- **That one cooperative server exposed a real bug, now fixed.** It answered with
  `No session available`, thrown by our own `DAVESession`: the underlying davey
  session was only created on `dave_prepare_epoch` (opcode 24), but the voice server
  sends the external sender (25) and proposals (27) _before_ announcing the epoch.
  `@discordjs/voice` calls `session.reinit()` the moment it builds the session; this
  port had dropped that line. `createDaveSession` now initialises eagerly, with a
  regression test. No amount of offline testing would have found this — only a voice
  server that got far enough to send the frame.

Group DM with a second account passes end to end, and turned up an API gap rather
than a bug:

- **`ring()` cannot start a call.** With no call in progress Discord answers `{}`
  and does nothing at all — no `CALL_CREATE`, no ringing. A call comes into being
  when you send a voice state update naming the channel, which is what the real
  client does when you press the call button; only then does `ring()` produce
  `CALL_UPDATE` with the recipient listed. The fork exposes no method for that
  first step, so the suite sends the gateway payload itself. Anyone using `ring()`
  on its own will find it silently doing nothing.

Ownership transfer is deliberately absent from the suite. `setOwner` cannot be
undone — you cannot take the group back — and the cleanup step would only make the
client leave, stranding the channel on the second account forever.

The call itself is only signalling here. Actually hearing anything would need the
voice gateway, which is blocked by DAVE.

`SKIP` in the table below means the check could not run, not that it passed. The
four profile writes are blocked by hCaptcha on `PATCH /users/@me`: the library
behaves correctly by surfacing the `400`, and testing them needs a `captchaSolver`
configured on the client.

## Not tested against a real account

Nothing below has ever run against Discord. The table further down does not
mention them at all — absence there means untested, not passing.

| Area                                                                                                                                                   | Why it is not in a suite                                                                                                                                                                                                                      | What it would take                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Voice, video, Go Live** — `playAudio`, `playVideo`, `createStreamConnection`, `joinStreamConnection`, `receiver.createStream`, `guildMemberSpeaking` | Blocked, not merely untried. DAVE is now implemented via `@snazzah/davey`, so `4017` is gone; the voice websocket is closed with `4006 Session is no longer valid` instead, with every IDENTIFY field verified correct against a live gateway | A 4006 that is Discord's, not ours — see the Tier 3 notes. Audio would also need `ffmpeg` and an Opus binding, neither bundled. Video and Go Live are still not E2EE |
| **Group DM ownership** — `setOwner`, `edit({ owner })`                                                                                                 | Everything else in a group DM with a second account is tested now. Handing the group over cannot be undone, and cleanup would leave the channel stranded on the other account                                                                 | A throwaway pair of accounts, run by hand                                                                                                                            |
| **Interaction components** — `clickButton`, `selectMenu`, modal submit, attachment options                                                             | `searchApplicationCommands` and `sendSlash` are tested now. The reply the suite got back had no components, so there was nothing to click                                                                                                     | A command whose answer carries buttons or a select menu, pinned through `SMOKE_INTERACTION_COMMAND`                                                                  |
| **`acceptInvite`**                                                                                                                                     | Joining a guild is not undoable in the way the write suite requires, and leaving again is a separate visible action                                                                                                                           | A throwaway guild to join and leave                                                                                                                                  |
| **Profile writes** — `setAboutMe`, `setPronouns`, `setGlobalName`, `setAccentColor`                                                                    | `PATCH /users/@me` answers with an hCaptcha challenge. They appear as `SKIP` in the table below                                                                                                                                               | A `captchaSolver` configured on the client                                                                                                                           |
| **`logout`, `Session#logout`, `logoutAllDevices`**                                                                                                     | They invalidate the token or kill sessions, including the one running the test                                                                                                                                                                | A throwaway account                                                                                                                                                  |
| **`QRLogin`, `passLogin`**                                                                                                                             | `QRLogin` needs a human to scan with a phone; `passLogin` needs the account password and reliably draws a captcha                                                                                                                             | Manual runs, and a solver for the password path                                                                                                                      |
| **`redeemNitro`, `installUserApps`, `deauthorize`, `authorizeURL`, `setHypeSquad`, `setUsername`**                                                     | Cost money, change public state, or cannot be undone                                                                                                                                                                                          | Deliberately left out; not planned                                                                                                                                   |
| **Account settings arriving over the gateway**                                                                                                         | Discord sends `USER_SETTINGS_PROTO_UPDATE`, a protobuf payload the fork does not decode. Its JSON `USER_SETTINGS_UPDATE` handler never fires, so there is nothing to exercise                                                                 | A protobuf decoder for `PreloadedUserSettings`; out of scope for now                                                                                                 |

## Results

| Suite       | PASS | FAIL | SKIP |
| ----------- | ---- | ---- | ---- |
| PASS        | 0    | 0    | 1    |
| 0           | 0    | 0    | 0    |
| 15          | 0    | 0    | 0    |
| 16          | 0    | 0    | 0    |
| 2           | 0    | 0    | 0    |
| 8           | 0    | 0    | 0    |
| write       | 15   | 0    | 5    |
| readonly    | 16   | 0    | 0    |
| message     | 16   | 0    | 0    |
| interaction | 2    | 0    | 2    |
| groupdm     | 8    | 0    | 0    |
| voice       | 0    | 5    | 0    |

| Date             | Suite       | Check                                                   | Result |
| ---------------- | ----------- | ------------------------------------------------------- | ------ |
| Suite            | PASS        | FAIL                                                    | SKIP   |
| 8                | 0           | 0                                                       | 0      |
| voice            | 0           | 5                                                       | 0      |
| write            | 15          | 0                                                       | 5      |
| message          | 16          | 0                                                       | 0      |
| interaction      | 2           | 0                                                       | 2      |
| groupdm          | 8           | 0                                                       | 0      |
| 2026-08-04 04:49 | write       | user.setAboutMe()                                       | SKIP   |
| 2026-08-04 04:49 | write       | user.setPronouns()                                      | SKIP   |
| 2026-08-04 04:49 | write       | user.setGlobalName()                                    | SKIP   |
| 2026-08-04 04:49 | write       | user.setAccentColor()                                   | SKIP   |
| 2026-08-04 04:49 | write       | settings.setTheme()                                     | PASS   |
| 2026-08-04 04:49 | write       | settings.toggleCompactMode()                            | PASS   |
| 2026-08-04 04:49 | write       | settings.setCustomStatus()                              | PASS   |
| 2026-08-04 04:49 | write       | notes.updateNote()                                      | PASS   |
| 2026-08-04 04:49 | write       | relationships.setNickname()                             | PASS   |
| 2026-08-04 04:49 | write       | user.createFriendInvite() + revokeAllFriendInvites()    | PASS   |
| 2026-08-04 04:49 | write       | setPresence(CustomStatus)                               | PASS   |
| 2026-08-04 04:49 | write       | setPresence(RichPresence)                               | PASS   |
| 2026-08-04 04:49 | write       | setPresence(SpotifyRPC)                                 | PASS   |
| 2026-08-04 04:49 | write       | setPresence(clear)                                      | PASS   |
| 2026-08-04 04:49 | write       | settings.addRestrictedGuild() + removeRestrictedGuild() | PASS   |
| 2026-08-04 04:49 | write       | guild.settings.edit()                                   | PASS   |
| 2026-08-04 04:49 | write       | RichPresence.getExternal()                              | PASS   |
| 2026-08-04 04:49 | write       | gateway day nguoc packet cua cac thao tac vua ghi       | PASS   |
| 2026-08-04 04:49 | write       | handler emit event tuong ung                            | PASS   |
| 2026-08-04 04:49 | write       | setting tai khoan dong bo nguoc qua gateway             | SKIP   |
| 2026-08-04 04:56 | readonly    | ready + client.user                                     | PASS   |
| 2026-08-04 04:56 | readonly    | relationships from READY                                | PASS   |
| 2026-08-04 04:56 | readonly    | guilds from READY                                       | PASS   |
| 2026-08-04 04:56 | readonly    | user_guild_settings patched onto Guild                  | PASS   |
| 2026-08-04 04:56 | readonly    | settings.fetch()                                        | PASS   |
| 2026-08-04 04:56 | readonly    | sessions.fetch()                                        | PASS   |
| 2026-08-04 04:56 | readonly    | notes.fetch(first friend)                               | PASS   |
| 2026-08-04 04:56 | readonly    | users.fetch(self, force)                                | PASS   |
| 2026-08-04 04:56 | readonly    | billing.fetchPaymentSources()                           | PASS   |
| 2026-08-04 04:56 | readonly    | billing.fetchGuildBoosts()                              | PASS   |
| 2026-08-04 04:56 | readonly    | billing.fetchCurrentSubscription()                      | PASS   |
| 2026-08-04 04:56 | readonly    | user.fetchFriendInvites()                               | PASS   |
| 2026-08-04 04:56 | readonly    | authorizedApplications()                                | PASS   |
| 2026-08-04 04:56 | readonly    | channel.searchApplicationCommands()                     | PASS   |
| 2026-08-04 04:56 | readonly    | users.fetch(friend, force)                              | PASS   |
| 2026-08-04 04:56 | readonly    | relationships.fetch(user)                               | PASS   |
| 2026-08-04 04:56 | message     | channel.send()                                          | PASS   |
| 2026-08-04 04:56 | message     | messages.fetch()                                        | PASS   |
| 2026-08-04 04:56 | message     | message.edit()                                          | PASS   |
| 2026-08-04 04:56 | message     | message.reply()                                         | PASS   |
| 2026-08-04 04:56 | message     | message.react() + go reaction                           | PASS   |
| 2026-08-04 04:56 | message     | channel.sendTyping()                                    | PASS   |
| 2026-08-04 04:56 | message     | message.pin() + unpin()                                 | PASS   |
| 2026-08-04 04:56 | message     | send kem file dinh kem                                  | PASS   |
| 2026-08-04 04:56 | message     | awaitMessages()                                         | PASS   |
| 2026-08-04 04:56 | message     | WebEmbed link duoc Discord unfurl                       | PASS   |
| 2026-08-04 04:56 | message     | message.delete()                                        | PASS   |
| 2026-08-04 04:56 | message     | refreshAttachmentURL()                                  | PASS   |
| 2026-08-04 04:56 | message     | channel.setName()                                       | PASS   |
| 2026-08-04 04:56 | message     | channel.setIcon()                                       | PASS   |
| 2026-08-04 04:56 | message     | createInvite() + fetchInvites() + deleteInvite()        | PASS   |
| 2026-08-04 04:56 | message     | channel.delete()                                        | PASS   |
| 2026-08-04 10:50 | interaction | searchApplicationCommands() liet ke lenh that           | PASS   |
| 2026-08-04 10:50 | interaction | channel.sendSlash()                                     | PASS   |
| 2026-08-04 10:50 | interaction | message.clickButton()                                   | SKIP   |
| 2026-08-04 10:50 | interaction | message.selectMenu()                                    | SKIP   |
| 2026-08-04 11:21 | groupdm     | channel.addUser()                                       | PASS   |
| 2026-08-04 11:21 | groupdm     | channel.fetchOwner()                                    | PASS   |
| 2026-08-04 11:21 | groupdm     | CallState.setRTCRegion()                                | PASS   |
| 2026-08-04 11:21 | groupdm     | user.stopRinging()                                      | PASS   |
| 2026-08-04 11:21 | groupdm     | channel.removeUser()                                    | PASS   |
| 2026-08-04 11:21 | groupdm     | mo cuoc goi bang voice state update + callCreate        | PASS   |
| 2026-08-04 11:21 | groupdm     | channel.ring() + callUpdate                             | PASS   |
| 2026-08-04 11:21 | groupdm     | roi cuoc goi + callDelete                               | PASS   |
| 2026-08-04 12:49 | voice       | voice.joinChannel()                                     | FAIL   |
| 2026-08-04 12:49 | voice       | connection.playAudio()                                  | FAIL   |
| 2026-08-04 12:49 | voice       | connection.createStreamConnection()                     | FAIL   |
| 2026-08-04 12:49 | voice       | receiver.createStream()                                 | FAIL   |
| 2026-08-04 12:49 | voice       | connection.disconnect()                                 | FAIL   |
