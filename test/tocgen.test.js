'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { listPages } = require('../src/files');
const { renderToc } = require('../src/tocgen');

const root = path.join(__dirname, '..');

function copyDocs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-toc-'));
  fs.cpSync(path.join(root, 'docs'), path.join(dir, 'docs'), { recursive: true });
  return path.join(dir, 'docs');
}

function pagesOf(docsDir) {
  return listPages(docsDir, { exclude: [path.join(docsDir, 'toc-test.md')] });
}

function writePage(dir, rel, text) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  return { rel, abs };
}

test('matches docs/toc-test.md byte for byte with maxdepth 3 and no header', () => {
  const docsDir = copyDocs();
  const toc = renderToc(pagesOf(docsDir), { maxdepth: 3, header: false });
  const golden = fs.readFileSync(path.join(root, 'docs/toc-test.md'), 'utf8');
  assert.equal(toc, golden);
});
