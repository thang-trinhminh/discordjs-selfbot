**English** | [Tiếng Việt](./README.vi.md)

<div align="center">

<h1>discordjs-selfbot</h1>

<p><strong>discord.js v14 for user accounts.</strong><br>
A successor to the archived <a href="https://github.com/aiko-chan-ai/discord.js-selfbot-v13"><code>discord.js-selfbot-v13</code></a>, built on <a href="https://github.com/discordjs/discord.js">discord.js</a> <code>v14.27.0</code>.</p>

<p>
<a href="https://www.npmjs.com/package/@trickstarcandina/discordjs-selfbot"><img alt="npm version" src="https://img.shields.io/npm/v/@trickstarcandina/discordjs-selfbot?logo=npm&color=cb3837"></a>
<a href="https://npm-stat.com/charts.html?package=%40trickstarcandina%2Fdiscordjs-selfbot"><img alt="Downloads per month" src="https://img.shields.io/npm/dm/@trickstarcandina/discordjs-selfbot?label=downloads&color=blue"></a>
<a href="https://npm-stat.com/charts.html?package=%40trickstarcandina%2Fdiscordjs-selfbot"><img alt="Total downloads" src="https://img.shields.io/npm/dt/@trickstarcandina/discordjs-selfbot?label=total&color=blue"></a>
<a href="https://www.npmjs.com/package/@trickstarcandina/discordjs-selfbot?activeTab=code"><img alt="Unpacked size" src="https://img.shields.io/npm/unpacked-size/@trickstarcandina/discordjs-selfbot"></a>
<a href="./typings/index.d.ts"><img alt="TypeScript types included" src="https://img.shields.io/npm/types/@trickstarcandina/discordjs-selfbot?logo=typescript&logoColor=white"></a>
</p>

<p>
<a href="https://github.com/discordjs/discord.js/tree/14.27.0"><img alt="Based on discord.js v14.27.0" src="https://img.shields.io/badge/discord.js-v14.27.0-5865F2?logo=discord&logoColor=white"></a>
<a href="./package.json"><img alt="Node.js version" src="https://img.shields.io/node/v/@trickstarcandina/discordjs-selfbot?logo=node.js&logoColor=white&color=339933"></a>
<a href="https://github.com/trickstarcandina/discordjs-selfbot/actions/workflows/publish.yml"><img alt="Publish workflow" src="https://img.shields.io/github/actions/workflow/status/trickstarcandina/discordjs-selfbot/publish.yml?label=publish&logo=githubactions&logoColor=white"></a>
<a href="https://github.com/trickstarcandina/discordjs-selfbot/actions/workflows/security.yml"><img alt="Security workflow" src="https://img.shields.io/github/actions/workflow/status/trickstarcandina/discordjs-selfbot/security.yml?label=security&logo=githubactions&logoColor=white"></a>
<a href="./LICENSE"><img alt="License" src="https://img.shields.io/npm/l/@trickstarcandina/discordjs-selfbot?color=yellow"></a>
</p>

<p>
<a href="https://www.npmjs.com/package/@trickstarcandina/discordjs-selfbot"><b>npm</b></a> ·
<a href="https://github.com/trickstarcandina/discordjs-selfbot/pkgs/npm/discordjs-selfbot"><b>GitHub Packages</b></a> ·
<a href="https://github.com/trickstarcandina/discordjs-selfbot/releases"><b>Releases</b></a> ·
<a href="./CHANGELOG.md"><b>Changelog</b></a> ·
<a href="./docs/API.md"><b>API</b></a> ·
<a href="./examples"><b>Examples</b></a>
</p>

</div>

> [!CAUTION]
> Automating a user account **violates Discord's Terms of Service** and can get the
> account disabled. Use at your own risk, and prefer a throwaway account.

## Installation

Requires **Node.js 22.12** or newer.

```sh
npm install @trickstarcandina/discordjs-selfbot
# or
pnpm add @trickstarcandina/discordjs-selfbot
# or
yarn add @trickstarcandina/discordjs-selfbot
```

### Voice (optional)

Voice needs three extra pieces, none of them bundled:

```sh
npm install @snazzah/davey      # DAVE end-to-end encryption, required by Discord
npm install @discordjs/opus     # or opusscript, to send audio
# and ffmpeg on PATH
```

Discord has required the DAVE end-to-end encryption protocol on every non-stage
voice call since March 2026 and hangs up on clients that cannot speak it.
`@snazzah/davey` is an `optionalDependency` so that people who never touch voice
are not made to build a native module; without it `joinChannel` throws a sentence
naming the package.

### From GitHub Packages

Every release is also published to GitHub Packages. GitHub requires a token with
`read:packages` even for public packages:

```ini
# .npmrc
@trickstarcandina:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## Quick start

```js
const { Client } = require('@trickstarcandina/discordjs-selfbot');

const client = new Client({}); // no intents needed

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`${client.relationships.friendCache.size} friends`);
});

client.login(process.env.DISCORD_TOKEN);
```

To check the library against your own token, copy [`.env.example`](./.env.example)
to `.env` and run:

```sh
node --env-file=.env scripts/smoke/readonly.mjs
```

Each run costs one identify, so space them out. See
[`scripts/smoke/README.md`](./scripts/smoke/README.md).

## Features

| Area                                                    | Status                           |
| ------------------------------------------------------- | -------------------------------- |
| REST (header spoofing, TLS fingerprint, proxy, captcha) | ✅ Done                          |
| Gateway (user account identify)                         | ✅ Done                          |
| Relationships, sessions, notes, settings, billing       | ✅ Done                          |
| Group DMs, calls                                        | ✅ Done                          |
| Custom status, rich presence, Spotify RPC               | ✅ Done                          |
| WebEmbed                                                | ✅ Done                          |
| Sending interactions as a user                          | ✅ Done                          |
| QR login, password login (with 2FA)                     | ✅ Done                          |
| v13 compatibility layer + codemod                       | ✅ Done                          |
| TypeScript typings                                      | ✅ Done                          |
| Voice / video / Go Live                                 | ⚠️ Works, needs `@snazzah/davey` |

The project is **pre-1.0**: the API can still change between minor versions, and
every breaking change is listed in the [changelog](./CHANGELOG.md).

> [!IMPORTANT]
> Login and the read-only surface have been exercised against a real account
> (see [`scripts/smoke/results.md`](./scripts/smoke/results.md)). Everything
> beyond that is still covered only by offline unit tests. Constants such as
> `client_build_number`, `capabilities`, `SpotifyRPC.flags` and most of the routes
> in `src/util/UserRoutes.js` come from the v13 fork and remain **unverified**
> against today's Discord.

> [!WARNING]
> Voice joins a real channel and passes its whole smoke suite: join, play,
> receive stream, Go Live connection, leave. Two things are still unproven: no
> human has listened to the audio, and alone in a channel the DAVE group never
> reaches an epoch, so the end-to-end encryption path itself has never run against
> Discord. Video and Go Live are not end-to-end encrypted at all.

## Package

| Item               | Details                                                                                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Registries**     | [npmjs.com](https://www.npmjs.com/package/@trickstarcandina/discordjs-selfbot) (primary), [GitHub Packages](https://github.com/trickstarcandina/discordjs-selfbot/pkgs/npm/discordjs-selfbot) (mirror)                                               |
| **Download stats** | [npm-stat](https://npm-stat.com/charts.html?package=%40trickstarcandina%2Fdiscordjs-selfbot) charts by day, week and month                                                                                                                           |
| **Release notes**  | [`CHANGELOG.md`](./CHANGELOG.md) and [GitHub Releases](https://github.com/trickstarcandina/discordjs-selfbot/releases)                                                                                                                               |
| **Module format**  | CommonJS, with TypeScript typings in [`typings/`](./typings)                                                                                                                                                                                         |
| **Provenance**     | Releases are built and published by [GitHub Actions](./.github/workflows/publish.yml) through npm Trusted Publishing, with no stored token. npm links each version to the commit it was built from; verify your install with `npm audit signatures`. |

## Documentation

| Where                                    | What                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| [`docs/API.md`](./docs/API.md)           | Everything this fork adds, by area, with a tested/unit/ported status per item |
| [`MIGRATION.md`](./MIGRATION.md)         | Moving code from `discord.js-selfbot-v13`, and the codemod                    |
| [`UPSTREAM.md`](./UPSTREAM.md)           | Which upstream files were patched, why, and how to upgrade                    |
| [`SECURITY.md`](./SECURITY.md)           | Reporting a vulnerability, audit commands, the release checklist              |
| [`examples/`](./examples)                | Nine runnable scripts                                                         |
| [`scripts/smoke/`](./scripts/smoke)      | Checking a real token, and the log of past runs                               |
| [discord.js.dev](https://discord.js.dev) | Everything not selfbot-specific, unchanged from upstream                      |

## Examples

[`examples/`](./examples) holds nine runnable scripts: token, QR and password
login; rich presence; invoking slash commands; group DMs and calls; WebEmbed;
proxy; voice. They use placeholder ids, so fill in your own before running.

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
npm run security          # npm audit + security tests + package contents check
```

Git hooks run through husky, split by speed:

| Hook         | Runs                                          | Takes |
| ------------ | --------------------------------------------- | ----- |
| `pre-commit` | lint-staged (staged files only) + unit tests  | ~3s   |
| `pre-push`   | full lint + unit tests + `tsc` and both `tsd` | ~25s  |

The hooks are the day-to-day gate: there is no CI on push, so `--no-verify` skips
every check. GitHub Actions runs in three places only:

- **`publish`**, on every GitHub release: lint, tests, type checks, `npm audit`,
  registry signatures and a check of the tarball contents, then publishes.
- **`security`**, weekly and on demand: `npm audit`, signatures, the security
  tests and CodeQL.
- **`stats`**, daily: redraws the download chart at the bottom of this page and
  pushes it to the `stats` branch. It is the only workflow that writes to the repo.

Convention: user-account code goes in **new files**. Editing an upstream file is a
last resort and must be recorded in the `UPSTREAM.md` table.

## Security

Please report vulnerabilities privately; see [`SECURITY.md`](./SECURITY.md) for
how, and for the list of issues already fixed.

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

## Stats

Weekly downloads from npmjs.com (GitHub Packages not included), redrawn every day
by the [`stats` workflow](./.github/workflows/stats.yml), with a dashed line for each
release. Click the chart for npm-stat's daily breakdown.

<div align="center">

<a href="https://npm-stat.com/charts.html?package=%40trickstarcandina%2Fdiscordjs-selfbot">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/trickstarcandina/discordjs-selfbot/stats/downloads-dark.svg">
    <img alt="npm downloads per week" src="https://raw.githubusercontent.com/trickstarcandina/discordjs-selfbot/stats/downloads-light.svg" width="800">
  </picture>
</a>

<a href="https://star-history.com/#trickstarcandina/discordjs-selfbot&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=trickstarcandina/discordjs-selfbot&type=Date&theme=dark">
    <img alt="GitHub stars over time" src="https://api.star-history.com/svg?repos=trickstarcandina/discordjs-selfbot&type=Date" width="800">
  </picture>
</a>

</div>
