**English** | [Tiếng Việt](./README.vi.md)

# @trickstarcandina/discordjs-selfbot

A fork of [discord.js](https://github.com/discordjs/discord.js) `v14.27.0` for user
accounts, replacing the archived
[`discord.js-selfbot-v13`](https://github.com/aiko-chan-ai/discord.js-selfbot-v13).

> [!CAUTION]
> Automating a user account **violates Discord's Terms of Service** and can get the
> account disabled. Use at your own risk, and prefer a throwaway account.

## Status

Under development, **not ready for production**. Not published to npm.

| Area                                                    | Status                        |
| ------------------------------------------------------- | ----------------------------- |
| REST (header spoofing, TLS fingerprint, proxy, captcha) | done                          |
| Gateway (user account identify)                         | done                          |
| Relationships, sessions, notes, settings, billing       | done                          |
| Group DMs, calls                                        | done                          |
| Custom status, rich presence, Spotify RPC               | done                          |
| WebEmbed                                                | done                          |
| v13 compatibility layer + codemod                       | done                          |
| TypeScript                                              | done                          |
| Sending interactions as a user                          | done                          |
| Voice / video / Go Live                                 | works, needs `@snazzah/davey` |
| QR login, password login (with 2FA)                     | done                          |

> [!IMPORTANT]
> Login and the read-only surface have been exercised against a real account
> (see [`scripts/smoke/results.md`](./scripts/smoke/results.md)). Everything
> beyond that is still covered only by offline unit tests. Constants such as
> `client_build_number`, `capabilities`, `SpotifyRPC.flags` and most of the routes
> in `src/util/UserRoutes.js` come from the v13 fork and remain **unverified**
> against today's Discord.

> [!IMPORTANT]
> **Voice needs `@snazzah/davey`.** `npm i @snazzah/davey`. Discord has required
> the DAVE end-to-end encryption protocol on every non-stage voice call since
> March 2026 and hangs up on clients that cannot speak it. It is an
> `optionalDependency` so that people who never touch voice are not made to build
> a native module; without it `joinChannel` throws a sentence naming the package.
> Sending audio also needs `ffmpeg` on `PATH` and an Opus binding
> (`@discordjs/opus`, or `opusscript`), neither of which is bundled.

> [!WARNING]
> Voice joins a real channel and passes its whole smoke suite — join, play,
> receive stream, Go Live connection, leave. Two things are still unproven: no
> human has listened to the audio, and alone in a channel the DAVE group never
> reaches an epoch, so the end-to-end encryption path itself has never run against
> Discord. Video and Go Live are not end-to-end encrypted at all.

## Docs

| Where                                    | What                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| [`docs/API.md`](./docs/API.md)           | Everything this fork adds, by area, with a tested/unit/ported status per item |
| [`MIGRATION.md`](./MIGRATION.md)         | Moving code from `discord.js-selfbot-v13`, and the codemod                    |
| [`UPSTREAM.md`](./UPSTREAM.md)           | Which upstream files were patched, why, and how to upgrade                    |
| [`examples/`](./examples)                | Nine runnable scripts                                                         |
| [`scripts/smoke/`](./scripts/smoke)      | Checking a real token, and the log of past runs                               |
| [discord.js.dev](https://discord.js.dev) | Everything not selfbot-specific — unchanged from upstream                     |

## Install

Requires Node.js 20.18 or newer.

```sh
npm install @trickstarcandina/discordjs-selfbot
```

## Usage

```js
const { Client } = require('@trickstarcandina/discordjs-selfbot');

const client = new Client({}); // no intents needed

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`${client.relationships.friendCache.size} friends`);
});

client.login(process.env.DISCORD_TOKEN);
```

Check the foundation against a real token:

```sh
node --env-file=.env scripts/smoke/readonly.mjs
```

Copy [`.env.example`](./.env.example) to `.env` first. See
[`scripts/smoke/README.md`](./scripts/smoke/README.md) — each run costs one
identify, so space runs out.

## Examples

[`examples/`](./examples) holds nine runnable scripts: token, QR and password
login; rich presence; invoking slash commands; group DMs and calls; WebEmbed;
proxy; voice. They use placeholder ids — fill in your own before running.

## Migrating from v13

The compatibility layer is on by default, so most old code runs unchanged. What
must change, and what the codemod handles, is in [`MIGRATION.md`](./MIGRATION.md).

## Relationship to upstream

This repo is a copy of `packages/discord.js/{src,typings}` at a pinned commit,
plus the user-account additions.

[`UPSTREAM.md`](./UPSTREAM.md) records the commit being tracked and **the full
table of modified upstream files with a reason each**. Keeping that table short is
a design goal: every extra divergent file is another manual merge later.

Upgrading is a merge, not a re-patch. The `upstream-vendor` branch holds pristine
upstream sources and acts as the merge base:

```sh
cd ../discord.js && git fetch          # refresh the upstream clone
./scripts/sync-upstream.sh origin/v14  # write a commit onto upstream-vendor
git merge upstream-vendor              # git reapplies the selfbot patches
npm test
```

## Development

```sh
npm run lint              # eslint + prettier
node --test               # unit tests
npm run test:typescript   # tsc + tsd
npm test                  # all three
```

Git hooks run through husky, split by speed:

| Hook         | Runs                                          | Takes |
| ------------ | --------------------------------------------- | ----- |
| `pre-commit` | lint-staged (staged files only) + unit tests  | ~3s   |
| `pre-push`   | full lint + unit tests + `tsc` and both `tsd` | ~25s  |

There is no CI: the hooks are the only gate, so `--no-verify` skips every check
and hooks only ever run on your local Node version.

Convention: user-account code goes in **new files**; editing an upstream file is a
last resort and must be recorded in the `UPSTREAM.md` table.

## License

GPL-3.0-or-later. See [`LICENSE`](./LICENSE).

This is a copyleft license: anything you build on top of this library and then
distribute has to be released under the GPL-3.0 as well, with source.

The license is GPL rather than Apache because the user-account voice stack under
`src/client/voice/` is ported from
[discord.js-selfbot-v13](https://github.com/aiko-chan-ai/discord.js-selfbot-v13),
which is GPL-3.0. Everything inherited from
[discord.js](https://github.com/discordjs/discord.js) remains available to you
under Apache-2.0, whose text is kept in [`LICENSE-APACHE`](./LICENSE-APACHE).
[`NOTICE`](./NOTICE) spells out the attribution for both upstreams.
