**English** | [Tiếng Việt](./README.vi.md)

# Smoke tests

These need a real token and never run in CI. The token is read from the
environment, not passed as an argument — arguments leak through `ps` and shell
history.

    node --env-file=.env scripts/smoke/readonly.mjs

| Script         | Proves                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `login.mjs`    | P0-P2: REST shim + user account identify + gateway connect, `ready` fires, `client.user` is correct        |
| `readonly.mjs` | Eight read-only checks in **one** login: relationships, guild settings, settings, sessions, notes, profile |

Per-run results live in [`results.md`](./results.md) — dates and pass/fail only, no
account data.

Every run costs one identify. Discord flags accounts that reconnect in bursts, so
`readonly.mjs` gathers all eight checks into a single session and pauses
`SMOKE_CALL_DELAY_MS` (2s by default) between requests. Leave at least 30s between
runs.

## Reading the close code on failure

| Code                                        | Meaning                                                | First place to look                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `4004`                                      | Authentication failed                                  | Bad token, or `rewriteAuthorization` did not run — check the `authorization` header no longer carries a `Bot ` prefix |
| `4013` / `4014`                             | Invalid / disallowed intents                           | The identify payload still carries `intents` — check that `patchShardSend` is called in `spawn()`                     |
| `401` from REST before reaching the gateway | The `/gateway/bot` interception did not match the path | Log `url` in `makeRequest`                                                                                            |
