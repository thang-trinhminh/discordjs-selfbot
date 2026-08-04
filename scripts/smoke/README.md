**English** | [Tiếng Việt](./README.vi.md)

# Smoke tests

These need a real token and never run in CI. The token is read from the
environment, not passed as an argument — arguments leak through `ps` and shell
history.

    node --env-file=.env scripts/smoke/readonly.mjs
    SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/write.mjs

| Script         | Proves                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login.mjs`    | P0-P2: REST shim + user account identify + gateway connect, `ready` fires, `client.user` is correct                                                                                                     |
| `write.mjs`    | Fourteen write checks in **one** login. Every one snapshots the current value, writes, reads back, restores and reads back again. A failed restore stops the whole script and prints the original value |
| `readonly.mjs` | Fifteen read-only checks in **one** login: relationships, guild settings, settings, sessions, notes, profile, billing, friend invites, authorized apps, attachment refresh, application-command search  |

Results live in [`results.md`](./results.md) — one table, one row per check, with
the date of the last run. Check names, dates and pass/fail only, no account data.

`write.mjs` refuses to start without `SMOKE_ALLOW_WRITE=1`, because it edits a real
profile. It never touches what it cannot put back: username, email and password
need the account password and Discord allows two changes an hour; HypeSquad leaves
a public badge; Nitro redemption and app authorization cost money or cannot be
undone. The friend-invite check skips itself unless the account currently has zero
invites, since the only cleanup is `revokeAllFriendInvites()` and that would take
pre-existing ones with it.

`SKIP` means the check could not run, not that it passed. Besides the friend-invite
guard, `refreshAttachmentURL()` needs `SMOKE_ATTACHMENT_URL` (an expired
`cdn.discordapp.com` link), `notes.fetch()` needs a friend in the cache, and the
four profile writes need a `captchaSolver` on the client — `PATCH /users/@me`
answers with an hCaptcha challenge.

Every run costs one identify. Discord flags accounts that reconnect in bursts, so
each script gathers all its checks into a single session and pauses between
requests: `SMOKE_CALL_DELAY_MS` (2s) for the read-only suite, about 35s per run,
and `SMOKE_WRITE_DELAY_MS` (3s) for the write suite, which sends five requests per
check and takes about four minutes. Leave at least 30s between runs.

## Reading the close code on failure

| Code                                        | Meaning                                                | First place to look                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `4004`                                      | Authentication failed                                  | Bad token, or `rewriteAuthorization` did not run — check the `authorization` header no longer carries a `Bot ` prefix |
| `4013` / `4014`                             | Invalid / disallowed intents                           | The identify payload still carries `intents` — check that `patchShardSend` is called in `spawn()`                     |
| `401` from REST before reaching the gateway | The `/gateway/bot` interception did not match the path | Log `url` in `makeRequest`                                                                                            |
