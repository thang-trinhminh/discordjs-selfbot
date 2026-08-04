**English** | [Tiếng Việt](./README.vi.md)

# Smoke tests

These need a real token and never run in CI. The token is read from the
environment, not passed as an argument — arguments leak through `ps` and shell
history.

    node --env-file=.env scripts/smoke/readonly.mjs
    SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/write.mjs
    SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/message.mjs
    SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/voice.mjs

| Script         | Proves                                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login.mjs`    | P0-P2: REST shim + user account identify + gateway connect, `ready` fires, `client.user` is correct                                                                                                                  |
| `write.mjs`    | Twenty write checks in **one** login. Every one snapshots the current value, writes, reads back, restores and reads back again. A failed restore stops the whole script and prints the original value                |
| `message.mjs`  | Sixteen checks in a throwaway group DM: send, fetch, edit, reply, react, typing, pin, file upload, attachment refresh, collector, WebEmbed unfurl, delete, and the channel management the sandbox owner can do alone |
| `voice.mjs`    | Joining a voice channel, playing audio, Go Live, receiving, leaving. Currently all it can prove is where Discord stops the fork — see the note below                                                                 |
| `readonly.mjs` | Sixteen read-only checks in **one** login: relationships, guild settings, settings, sessions, notes, profile, billing, friend invites, authorized apps, attachment refresh, application-command search               |

Results live in [`results.md`](./results.md) — one table, one row per check, with
the date of the last run. Check names, dates and pass/fail only, no account data.

`write.mjs` refuses to start without `SMOKE_ALLOW_WRITE=1`, because it edits a real
profile. It never touches what it cannot put back: username, email and password
need the account password and Discord allows two changes an hour; HypeSquad leaves
a public badge; Nitro redemption and app authorization cost money or cannot be
undone. The friend-invite check skips itself unless the account currently has zero
invites, since the only cleanup is `revokeAllFriendInvites()` and that would take
pre-existing ones with it.

`message.mjs` needs no channel of yours. It creates an empty group DM
(`POST /users/@me/channels` with `recipients: []`), which nobody else is in, runs
everything there and deletes the channel afterwards — including if a check throws
half way. A DM with yourself is not an option; Discord answers `400`. Its WebEmbed
check pushes the marker string through the third-party render service named in
`WebEmbed.DEFAULT_BASE_URL`; set `SMOKE_SKIP_WEBEMBED=1` to leave that one out.

`voice.mjs` needs `SMOKE_VOICE_CHANNEL_ID`, `ffmpeg` on `PATH`, and an Opus binding
(`opusscript` is a devDependency here; the library itself bundles neither, since
both are the consumer's choice). Joining a voice channel is **visible to the whole
server**, unlike every other suite — pick a quiet channel. It fails at the first
check today: Discord answers the voice IDENTIFY with `4017 E2EE/DAVE protocol
required` on every gateway version, and the fork does not speak DAVE.

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
