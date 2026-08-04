# Smoke test results

Run by hand against a real token, never in CI. This file records **dates and
pass/fail only** — return values (account tag, guild count, friend count,
settings) stay on the console and are not written down.

Times are UTC. The script appends one block per run, one row per check.

## Earlier runs (summary only)

Logged before the script recorded per-check results.

| Timestamp        | Suite    | Result | Failed checks            |
| ---------------- | -------- | ------ | ------------------------ |
| 2026-08-03 09:50 | readonly | 7/8    | users.fetch(self, force) |
| 2026-08-03 09:55 | readonly | 8/8    | —                        |

Before those two, the same day, `login.mjs` ran twice: the first failed (the READY
handler broke on `user_guild_settings` arriving as an object), the second passed
once patched. That script does not log itself.

The two bugs this round exposed are fixed, each with an offline test:

- `READY.js` — `user_guild_settings` arrives as `{ version, partial, entries }`,
  not an array.
- `UserManager.js` — `GET /users/:id` is bot-only; a user token gets 403 code 40001.

## Runs

New blocks are appended below.

The runs on 2026-08-04 added the eight read-only checks of tier 1b. What they
found:

- `user.fetchBurstCredit()` — `GET /users/@me/burst-credits` answers `404` on a
  live account. A direct probe outside the client got the same bare `404 code 0` on
  API v9 and v10, while `/users/@me/premium-usage` on the same token answered a
  typed `10084` and `/users/@me/billing/country-code` answered `200`. So the token
  is fine and the route is simply gone. The method, its route, its typing and its
  offline test were deleted, which is why later runs count 15 checks, not 16.
- `channel.searchApplicationCommands()` — failed `50013` on the first run because
  the check grabbed whatever channel came first in the cache. The route is fine;
  the check now prefers a DM and reads `50013` as "route reachable, channel blocks
  the permission". The middle run shows it skipping, which was a second bug in the
  check itself: `permissionsFor()` returns `null` when the self member is not
  cached, so every channel was filtered out.
- The other six passed on the first try.

### 2026-08-04 03:05 UTC — readonly 14/16

| Check                                  | Result |
| -------------------------------------- | ------ |
| ready + client.user                    | PASS   |
| relationships from READY               | PASS   |
| guilds from READY                      | PASS   |
| user_guild_settings patched onto Guild | PASS   |
| settings.fetch()                       | PASS   |
| sessions.fetch()                       | PASS   |
| notes.fetch(first friend)              | PASS   |
| users.fetch(self, force)               | PASS   |
| billing.fetchPaymentSources()          | PASS   |
| billing.fetchGuildBoosts()             | PASS   |
| billing.fetchCurrentSubscription()     | PASS   |
| user.fetchBurstCredit()                | FAIL   |
| user.fetchFriendInvites()              | PASS   |
| authorizedApplications()               | PASS   |
| refreshAttachmentURL()                 | PASS   |
| channel.searchApplicationCommands()    | FAIL   |

### 2026-08-04 03:07 UTC — readonly 15/16

| Check                                  | Result |
| -------------------------------------- | ------ |
| ready + client.user                    | PASS   |
| relationships from READY               | PASS   |
| guilds from READY                      | PASS   |
| user_guild_settings patched onto Guild | PASS   |
| settings.fetch()                       | PASS   |
| sessions.fetch()                       | PASS   |
| notes.fetch(first friend)              | PASS   |
| users.fetch(self, force)               | PASS   |
| billing.fetchPaymentSources()          | PASS   |
| billing.fetchGuildBoosts()             | PASS   |
| billing.fetchCurrentSubscription()     | PASS   |
| user.fetchBurstCredit()                | FAIL   |
| user.fetchFriendInvites()              | PASS   |
| authorizedApplications()               | PASS   |
| refreshAttachmentURL()                 | PASS   |
| channel.searchApplicationCommands()    | PASS   |

### 2026-08-04 03:08 UTC — readonly 15/16

| Check                                  | Result |
| -------------------------------------- | ------ |
| ready + client.user                    | PASS   |
| relationships from READY               | PASS   |
| guilds from READY                      | PASS   |
| user_guild_settings patched onto Guild | PASS   |
| settings.fetch()                       | PASS   |
| sessions.fetch()                       | PASS   |
| notes.fetch(first friend)              | PASS   |
| users.fetch(self, force)               | PASS   |
| billing.fetchPaymentSources()          | PASS   |
| billing.fetchGuildBoosts()             | PASS   |
| billing.fetchCurrentSubscription()     | PASS   |
| user.fetchBurstCredit()                | FAIL   |
| user.fetchFriendInvites()              | PASS   |
| authorizedApplications()               | PASS   |
| refreshAttachmentURL()                 | PASS   |
| channel.searchApplicationCommands()    | PASS   |

### 2026-08-04 03:17 UTC — readonly 15/15

| Check                                  | Result |
| -------------------------------------- | ------ |
| ready + client.user                    | PASS   |
| relationships from READY               | PASS   |
| guilds from READY                      | PASS   |
| user_guild_settings patched onto Guild | PASS   |
| settings.fetch()                       | PASS   |
| sessions.fetch()                       | PASS   |
| notes.fetch(first friend)              | PASS   |
| users.fetch(self, force)               | PASS   |
| billing.fetchPaymentSources()          | PASS   |
| billing.fetchGuildBoosts()             | PASS   |
| billing.fetchCurrentSubscription()     | PASS   |
| user.fetchFriendInvites()              | PASS   |
| authorizedApplications()               | PASS   |
| refreshAttachmentURL()                 | PASS   |
| channel.searchApplicationCommands()    | PASS   |
