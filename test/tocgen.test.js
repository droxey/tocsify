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

test('header on adds ### before each page link', () => {
  const docsDir = copyDocs();
  const toc = renderToc(pagesOf(docsDir), { maxdepth: 3 });
  assert.match(toc, /^### \[test\/markdown-guide\]\(test\/markdown-guide\.md\)/m);
  assert.equal(toc.includes('\n### [Markdown]'), false);
});

test('maxdepth limits heading levels', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-depth-'));
  const page = writePage(dir, 'guide.md', '# Guide\n## Two\n### Three\n');
  const toc = renderToc([page], { maxdepth: 2, header: false });
  assert.equal(toc.includes('Three'), false);
  assert.equal(toc.includes('Two'), true);
});

test('default maxdepth 6 includes level 6 headings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-depth6-'));
  const page = writePage(dir, 'deep.md', '###### Header 6\n');
  const toc = renderToc([page], { header: false });
  assert.match(toc, /Header 6\]\(deep\.md#header-6\)/);
});

test('leaves out headings with either ignore form', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-ign-'));
  const page = writePage(dir, 'page.md', [
    '# Page',
    '## Shown',
    '## Hidden {docsify-ignore}',
    '## Also <!-- {docsify-ignore} -->',
  ].join('\n'));
  const toc = renderToc([page], { header: false });
  assert.equal(toc.includes('Shown'), true);
  assert.equal(toc.includes('Hidden'), false);
  assert.equal(toc.includes('Also'), false);
});
