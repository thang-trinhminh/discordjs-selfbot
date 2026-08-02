'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('src/index.js loads', () => {
  const djs = require('../src/index.js');
  assert.strictEqual(typeof djs.Client, 'function');
  assert.strictEqual(typeof djs.Options, 'function');
});

test('upstream version is pinned to 14.27.0', () => {
  const pkg = require('../package.json');
  assert.strictEqual(pkg.dependencies['@discordjs/rest'], '2.5.1');
  assert.strictEqual(pkg.dependencies['@discordjs/ws'], '1.2.3');
  assert.ok(!pkg.dependencies['@discordjs/rest'].startsWith('^'), 'rest phai pin exact');
  assert.ok(!pkg.dependencies['@discordjs/ws'].startsWith('^'), 'ws phai pin exact');
});
