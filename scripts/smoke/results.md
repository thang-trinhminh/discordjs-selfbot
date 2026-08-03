# Smoke test results

Run by hand against a real token, never in CI. This file records **dates and
pass/fail only** — return values (account tag, guild count, friend count,
settings) stay on the console and are not written down.

> Chạy tay với token thật, không có trong CI. File này chỉ ghi **ngày và
> pass/fail** — giá trị trả về chỉ hiện trên console lúc chạy rồi mất.

Times are UTC. The script appends a row on every run.

| Timestamp        | Suite    | Result | Failed checks                  |
| ---------------- | -------- | ------ | ------------------------------ |
| 2026-08-03 09:50 | readonly | 7/8    | users.fetch(chinh minh, force) |
| 2026-08-03 09:55 | readonly | 8/8    | —                              |

Before those two, the same day, `login.mjs` ran twice: the first failed (the READY
handler broke on `user_guild_settings` arriving as an object), the second passed
once patched. That script does not log itself.

The two bugs this round exposed are fixed, each with an offline test:

- `READY.js` — `user_guild_settings` arrives as `{ version, partial, entries }`,
  not an array.
- `UserManager.js` — `GET /users/:id` is bot-only; a user token gets 403 code 40001.
