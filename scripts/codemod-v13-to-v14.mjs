#!/usr/bin/env node
// Sửa những chỗ compat layer KHÔNG cứu được, trên repo consumer.
//
// Chạy thử (mặc định, chỉ in ra):
//   node scripts/codemod-v13-to-v14.mjs ../repo-cua-toi/src
// Ghi thật:
//   node scripts/codemod-v13-to-v14.mjs ../repo-cua-toi/src --write
//
// Đây là công cụ hỗ trợ, KHÔNG phải trình kiểm chứng. Nó khớp bằng regex chứ
// không phân tích cú pháp — cố tình không kéo thêm babel/jscodeshift vào chỉ để
// chạy một lần. Mọi thay đổi đều in kèm file:dòng để người đọc duyệt lại, và
// chỗ nào mơ hồ thì nó báo thay vì đoán.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import process from 'node:process';
import {
  ActivityType,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonStyle,
  ChannelType,
  ComponentType,
  GuildDefaultMessageNotifications,
  GuildExplicitContentFilter,
  GuildNSFWLevel,
  GuildPremiumTier,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
  GuildVerificationLevel,
  InteractionType,
  MessageType,
  StageInstancePrivacyLevel,
  StickerFormatType,
  StickerType,
  TeamMemberMembershipState,
  TextInputStyle,
  VideoQualityMode,
} from 'discord-api-types/v10';

const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts']);
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);

/** Tên enum -> object enum, để dựng bảng tra ngược. */
const ENUMS = {
  ChannelType,
  ActivityType,
  MessageType,
  ComponentType,
  InteractionType,
  ButtonStyle,
  TextInputStyle,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  GuildVerificationLevel,
  GuildDefaultMessageNotifications,
  GuildExplicitContentFilter,
  GuildNSFWLevel,
  GuildPremiumTier,
  GuildScheduledEventStatus,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventEntityType,
  StageInstancePrivacyLevel,
  StickerType,
  StickerFormatType,
  VideoQualityMode,
  TeamMemberMembershipState,
};

/** Tên v13 -> tên v14, cho các chỗ v14 đổi hẳn tên. */
const RENAMED_MEMBERS = {
  ChannelType: {
    GUILD_NEWS: 'GuildAnnouncement',
    GUILD_NEWS_THREAD: 'AnnouncementThread',
    GUILD_PUBLIC_THREAD: 'PublicThread',
    GUILD_PRIVATE_THREAD: 'PrivateThread',
  },
  GuildDefaultMessageNotifications: { ALL_MESSAGES: 'AllMessages', ONLY_MENTIONS: 'OnlyMentions' },
  GuildPremiumTier: { NONE: 'None', TIER_1: 'Tier1', TIER_2: 'Tier2', TIER_3: 'Tier3' },
};

/**
 * Định danh mà compat layer cố tình KHÔNG alias, vì tên đó ở v14 đã mang nghĩa
 * khác. Code cũ dùng chúng là hỏng thật, không phải chỉ cũ.
 */
const RENAMED_IDENTIFIERS = {
  TextInputComponent: 'TextInputBuilder',
  CommandInteraction: 'ChatInputCommandInteraction',
  SelectMenuInteraction: 'StringSelectMenuInteraction',
  MessageFlags: 'MessageFlagsBitField',
  UserFlags: 'UserFlagsBitField',
  ActivityFlags: 'ActivityFlagsBitField',
  ApplicationFlags: 'ApplicationFlagsBitField',
  ChannelFlags: 'ChannelFlagsBitField',
  GuildMemberFlags: 'GuildMemberFlagsBitField',
  RoleFlags: 'RoleFlagsBitField',
  AttachmentFlags: 'AttachmentFlagsBitField',
  ThreadMemberFlags: 'ThreadMemberFlagsBitField',
};

function toScreamingSnake(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toUpperCase();
}

/**
 * Dựng bảng `TÊN_V13 -> [{ enumName, memberName, value, preferred }]`.
 * Một tên có thể thuộc nhiều enum (`DEFAULT`, `NONE`...), nên giá trị là mảng —
 * chỗ nào mơ hồ thì báo chứ không đoán.
 * @returns {Map<string, Array<Object>>}
 */
function buildReverseIndex() {
  const index = new Map();

  const add = (legacyName, enumName, memberName, value, preferred) => {
    if (!index.has(legacyName)) index.set(legacyName, []);
    index.get(legacyName).push({ enumName, memberName, value, preferred });
  };

  for (const [enumName, enumObject] of Object.entries(ENUMS)) {
    for (const key of Object.keys(enumObject)) {
      if (/^\d+$/.test(key)) continue;
      add(toScreamingSnake(key), enumName, key, enumObject[key], false);
    }
    for (const [legacyName, memberName] of Object.entries(RENAMED_MEMBERS[enumName] ?? {})) {
      if (memberName in enumObject) add(legacyName, enumName, memberName, enumObject[memberName], true);
    }
  }

  return index;
}

const REVERSE_INDEX = buildReverseIndex();

/** So sánh literal ở phía đọc: `x.type === 'GUILD_TEXT'`. */
const COMPARISON_PATTERN = /(\.\s*[A-Za-z_$][\w$]*\s*(?:!==?|===?)\s*)(['"])([A-Z][A-Z0-9_]{2,})\2/g;

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/**
 * Đổi so sánh literal thành tham chiếu enum.
 * @param {string} source Mã nguồn
 * @returns {{ code: string, changes: Array, ambiguous: Array, usedEnums: Set<string> }}
 */
function rewriteComparisons(source) {
  const changes = [];
  const ambiguous = [];
  const usedEnums = new Set();

  const code = source.replace(COMPARISON_PATTERN, (match, prefix, quote, legacyName, offset) => {
    const candidates = REVERSE_INDEX.get(legacyName);
    if (!candidates) return match;

    const line = lineOf(source, offset);

    // Mơ hồ là khi các ứng viên trỏ tới GIÁ TRỊ khác nhau. Cùng giá trị mà khác
    // tên chỉ là alias deprecated của discord-api-types (`GuildNews` với
    // `GuildAnnouncement`), chọn tên chuẩn là xong.
    const distinctValues = new Set(candidates.map(candidate => `${candidate.enumName}:${candidate.value}`));
    if (distinctValues.size > 1) {
      const shown = [...new Set(candidates.map(candidate => `${candidate.enumName}.${candidate.memberName}`))];
      ambiguous.push({ line, legacyName, candidates: shown });
      return match;
    }

    const { enumName, memberName } = candidates.find(candidate => candidate.preferred) ?? candidates[0];
    usedEnums.add(enumName);
    changes.push({ line, from: `'${legacyName}'`, to: `${enumName}.${memberName}` });
    return `${prefix}${enumName}.${memberName}`;
  });

  return { code, changes, ambiguous, usedEnums };
}

/**
 * Đổi định danh mà compat cố tình không alias.
 * @param {string} source Mã nguồn
 * @returns {{ code: string, changes: Array }}
 */
function rewriteIdentifiers(source) {
  const changes = [];
  let code = source;

  for (const [oldName, newName] of Object.entries(RENAMED_IDENTIFIERS)) {
    const pattern = new RegExp(`\\b${oldName}\\b`, 'g');
    let match;
    while ((match = pattern.exec(code)) !== null) {
      changes.push({ line: lineOf(code, match.index), from: oldName, to: newName });
    }
    code = code.replace(pattern, newName);
  }

  return { code, changes };
}

/**
 * Thêm import cho các enum vừa dùng, nếu file chưa có.
 * Bám theo kiểu module sẵn có của file để không trộn `import` với `require`.
 * @param {string} code Mã nguồn đã rewrite
 * @param {Set<string>} usedEnums Tên enum cần import
 * @returns {{ code: string, added: ?string }}
 */
function ensureEnumImport(code, usedEnums) {
  if (!usedEnums.size) return { code, added: null };

  // Chỉ soi dòng import/require. Soi cả file sẽ luôn thấy tên enum, vì phần
  // rewrite ở trên vừa chèn nó vào.
  const importLines = code.split('\n').filter(line => /^\s*(?:import\s|const\s.*=\s*require\()/.test(line));
  const alreadyImported = new Set();
  for (const line of importLines) {
    for (const name of usedEnums) if (new RegExp(`\\b${name}\\b`).test(line)) alreadyImported.add(name);
  }

  const missing = [...usedEnums].filter(name => !alreadyImported.has(name)).sort();
  if (!missing.length) return { code, added: null };

  const isEsm = /^\s*import\s/m.test(code);
  const line = isEsm
    ? `import { ${missing.join(', ')} } from 'discord-api-types/v10';`
    : `const { ${missing.join(', ')} } = require('discord-api-types/v10');`;

  // Chèn sau khối import/require ở đầu file, không phải sau dòng đầu tiên bất kỳ.
  const lines = code.split('\n');
  let insertAt = 0;
  let seenHeader = false;
  for (const [index, text] of lines.entries()) {
    if (/^\s*(?:import\s|const\s.*=\s*require\(|'use strict'|"use strict")/.test(text)) {
      insertAt = index + 1;
      seenHeader = true;
    } else if (text.trim() && seenHeader) {
      break;
    }
  }

  lines.splice(insertAt, 0, line);
  return { code: lines.join('\n'), added: line };
}

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      yield* walk(join(directory, entry.name));
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      yield join(directory, entry.name);
    }
  }
}

/**
 * Chạy codemod trên một chuỗi nguồn. Tách riêng để test được.
 * @param {string} source Mã nguồn
 * @returns {{ code: string, changes: Array, ambiguous: Array, importAdded: ?string, changed: boolean }}
 */
export function transform(source) {
  const comparisons = rewriteComparisons(source);
  const identifiers = rewriteIdentifiers(comparisons.code);
  const withImport = ensureEnumImport(identifiers.code, comparisons.usedEnums);

  return {
    code: withImport.code,
    changes: [...comparisons.changes, ...identifiers.changes],
    ambiguous: comparisons.ambiguous,
    importAdded: withImport.added,
    changed: withImport.code !== source,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const target = args.find(arg => !arg.startsWith('--'));

  if (!target) {
    console.error('Usage: node scripts/codemod-v13-to-v14.mjs <thu-muc> [--write]');
    process.exit(1);
  }

  let filesChanged = 0;
  let totalChanges = 0;
  let totalAmbiguous = 0;

  for await (const file of walk(target)) {
    const source = await readFile(file, 'utf8');
    const result = transform(source);
    if (!result.changed && !result.ambiguous.length) continue;

    const shown = relative(process.cwd(), file);

    if (result.changed) {
      filesChanged += 1;
      totalChanges += result.changes.length;
      console.log(`\n${shown}`);
      for (const change of result.changes) console.log(`  ${change.line}: ${change.from} -> ${change.to}`);
      if (result.importAdded) console.log(`  + ${result.importAdded}`);
      if (write) await writeFile(file, result.code);
    }

    for (const item of result.ambiguous) {
      totalAmbiguous += 1;
      if (!result.changed) console.log(`\n${shown}`);
      console.log(`  ${item.line}: '${item.legacyName}' MO HO -> ${item.candidates.join(' | ')} (sua tay)`);
    }
  }

  console.log(
    `\n${filesChanged} file, ${totalChanges} thay doi, ${totalAmbiguous} cho mo ho.${
      write ? ' Da ghi.' : ' Chay lai voi --write de ghi.'
    }`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
