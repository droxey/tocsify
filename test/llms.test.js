'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { resolveBaseUrl, buildSite, renderLlmsTxt, renderLlmsFull } = require('../src/llms');

const root = path.join(__dirname, '..');
const siteDir = path.join(root, 'test/fixtures/site');

function makeDocs(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-llms-'));
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

function siteOf(docsDir, options = {}) {
  return buildSite({
    docsDir,
    baseUrl: 'https://example.com/docs/',
    exclude: [],
    cwd: docsDir,
    onWarn: options.onWarn,
    group: options.group,
    title: options.title,
    summary: options.summary,
  });
}

test('--base-url wins and gains a trailing slash', () => {
  const dir = makeDocs({});
  assert.equal(resolveBaseUrl({
    flag: 'https://example.com/docs', docsDir: dir, cwd: dir, env: {}, gitRemote: () => '',
  }), 'https://example.com/docs/');
  assert.equal(resolveBaseUrl({
    flag: 'https://example.com/docs/', docsDir: dir, cwd: dir, env: {}, gitRemote: () => '',
  }), 'https://example.com/docs/');
});

test('rejects a --base-url that is not http or https', () => {
  const dir = makeDocs({});
  assert.throws(() => resolveBaseUrl({
    flag: 'ftp://example.com', docsDir: dir, cwd: dir, env: {}, gitRemote: () => '',
  }), /--base-url must start with http:\/\/ or https:\/\//);
});
