# Smoke test results

Run by hand against a real token, never in CI. This file records **check names,
dates and pass/fail only** — return values (account tag, guild count, friend
count, settings) stay on the console and are not written down.

Times are UTC. One table, one row per check. Re-running a check overwrites its
row and its date, so the table always shows the latest state rather than growing
a block per run.

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

`SKIP` in the table below means the check could not run, not that it passed. The
four profile writes are blocked by hCaptcha on `PATCH /users/@me`: the library
behaves correctly by surfacing the `400`, and testing them needs a `captchaSolver`
configured on the client.

## Not tested against a real account

Nothing below has ever run against Discord. The table further down does not
mention them at all — absence there means untested, not passing.

| Area                                                                                                                                                                  | Why it is not in a suite                                                                                                                                                          | What it would take                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Voice, video, Go Live** — `joinChannel`, `playAudio`, `playVideo`, `createStreamConnection`, `joinStreamConnection`, `receiver.createStream`, `guildMemberSpeaking` | The whole stack is `ported` from the v13 fork and has never opened a socket. UDP, RTP packetisation, the voice handshake and encryption can only be proven live                   | A guild with a voice channel, and a second listener to confirm anything is actually audible. Highest risk area in the fork |
| **Group DM with other people** — `addUser`, `removeUser`, `ring`, `setOwner`, `stopRinging`, `callCreate`/`callUpdate`/`callDelete`, `CallState.setRTCRegion`         | Every one of them needs somebody else in the channel. The sandbox group DM the message suite builds has no other members                                                          | A second account that accepts being added to a group DM                                                                    |
| **Sending interactions** — `sendSlash`, `clickButton`, `selectMenu`, modal submit, attachment options                                                                 | Needs another bot's commands to be usable in a channel the account can post in. `searchApplicationCommands` is tested, so the discovery route works; actually invoking one is not | A guild with a bot whose slash commands the account may run                                                                |
| **`acceptInvite`**                                                                                                                                                    | Joining a guild is not undoable in the way the write suite requires, and leaving again is a separate visible action                                                               | A throwaway guild to join and leave                                                                                        |
| **Profile writes** — `setAboutMe`, `setPronouns`, `setGlobalName`, `setAccentColor`                                                                                   | `PATCH /users/@me` answers with an hCaptcha challenge. They appear as `SKIP` in the table below                                                                                   | A `captchaSolver` configured on the client                                                                                 |
| **`logout`, `Session#logout`, `logoutAllDevices`**                                                                                                                    | They invalidate the token or kill sessions, including the one running the test                                                                                                    | A throwaway account                                                                                                        |
| **`QRLogin`, `passLogin`**                                                                                                                                            | `QRLogin` needs a human to scan with a phone; `passLogin` needs the account password and reliably draws a captcha                                                                 | Manual runs, and a solver for the password path                                                                            |
| **`redeemNitro`, `installUserApps`, `deauthorize`, `authorizeURL`, `setHypeSquad`, `setUsername`**                                                                    | Cost money, change public state, or cannot be undone                                                                                                                              | Deliberately left out; not planned                                                                                         |

## Results

| Date             | Suite    | Check                                                | Result |
| ---------------- | -------- | ---------------------------------------------------- | ------ |
| 2026-08-04 03:49 | write    | user.setAboutMe()                                    | SKIP   |
| 2026-08-04 03:49 | write    | user.setPronouns()                                   | SKIP   |
| 2026-08-04 03:49 | write    | user.setGlobalName()                                 | SKIP   |
| 2026-08-04 03:49 | write    | user.setAccentColor()                                | SKIP   |
| 2026-08-04 03:49 | write    | settings.setTheme()                                  | PASS   |
| 2026-08-04 03:49 | write    | settings.toggleCompactMode()                         | PASS   |
| 2026-08-04 03:49 | write    | settings.setCustomStatus()                           | PASS   |
| 2026-08-04 03:49 | write    | notes.updateNote()                                   | PASS   |
| 2026-08-04 03:49 | write    | relationships.setNickname()                          | PASS   |
| 2026-08-04 03:49 | write    | user.createFriendInvite() + revokeAllFriendInvites() | PASS   |
| 2026-08-04 03:49 | write    | setPresence(CustomStatus)                            | PASS   |
| 2026-08-04 03:49 | write    | setPresence(RichPresence)                            | PASS   |
| 2026-08-04 03:49 | write    | setPresence(SpotifyRPC)                              | PASS   |
| 2026-08-04 03:49 | write    | setPresence(clear)                                   | PASS   |
| 2026-08-04 03:50 | readonly | ready + client.user                                  | PASS   |
| 2026-08-04 03:50 | readonly | relationships from READY                             | PASS   |
| 2026-08-04 03:50 | readonly | guilds from READY                                    | PASS   |
| 2026-08-04 03:50 | readonly | user_guild_settings patched onto Guild               | PASS   |
| 2026-08-04 03:50 | readonly | settings.fetch()                                     | PASS   |
| 2026-08-04 03:50 | readonly | sessions.fetch()                                     | PASS   |
| 2026-08-04 03:50 | readonly | notes.fetch(first friend)                            | PASS   |
| 2026-08-04 03:50 | readonly | users.fetch(self, force)                             | PASS   |
| 2026-08-04 03:50 | readonly | billing.fetchPaymentSources()                        | PASS   |
| 2026-08-04 03:50 | readonly | billing.fetchGuildBoosts()                           | PASS   |
| 2026-08-04 03:50 | readonly | billing.fetchCurrentSubscription()                   | PASS   |
| 2026-08-04 03:50 | readonly | user.fetchFriendInvites()                            | PASS   |
| 2026-08-04 03:50 | readonly | authorizedApplications()                             | PASS   |
| 2026-08-04 03:50 | readonly | refreshAttachmentURL()                               | PASS   |
| 2026-08-04 03:50 | readonly | channel.searchApplicationCommands()                  | PASS   |
| 2026-08-04 04:23 | message  | channel.send()                                       | PASS   |
| 2026-08-04 04:23 | message  | messages.fetch()                                     | PASS   |
| 2026-08-04 04:23 | message  | message.edit()                                       | PASS   |
| 2026-08-04 04:23 | message  | message.reply()                                      | PASS   |
| 2026-08-04 04:23 | message  | message.react() + go reaction                        | PASS   |
| 2026-08-04 04:23 | message  | channel.sendTyping()                                 | PASS   |
| 2026-08-04 04:23 | message  | message.pin() + unpin()                              | PASS   |
| 2026-08-04 04:23 | message  | send kem file dinh kem                               | PASS   |
| 2026-08-04 04:23 | message  | awaitMessages()                                      | PASS   |
| 2026-08-04 04:23 | message  | WebEmbed link duoc Discord unfurl                    | PASS   |
| 2026-08-04 04:23 | message  | message.delete()                                     | PASS   |
