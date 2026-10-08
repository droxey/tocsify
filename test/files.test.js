'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { listPages, findHomePage } = require('../src/files');

function makeDocs(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-files-'));
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

test('lists .md files recursively in en locale order with / separators', () => {
  const dir = makeDocs({
    'B.md': '# B\n',
    'a.md': '# A\n',
    'sub/c.md': '# C\n',
  });
  const pages = listPages(dir);
  assert.deepEqual(pages.map((page) => page.rel), ['a.md', 'B.md', 'sub/c.md']);
  assert.equal(pages[2].abs, path.resolve(dir, 'sub/c.md'));
});

test('skips files whose names start with an underscore', () => {
  const dir = makeDocs({
    '_sidebar.md': '# S\n',
    'guide.md': '# G\n',
  });
  assert.deepEqual(listPages(dir).map((page) => page.rel), ['guide.md']);
});

test('keeps my_guide.md and api/v2_beta/intro.md', () => {
  const dir = makeDocs({
    'my_guide.md': '# M\n',
    'api/v2_beta/intro.md': '# I\n',
  });
  assert.deepEqual(listPages(dir).map((page) => page.rel), [
    'api/v2_beta/intro.md',
    'my_guide.md',
  ]);
});

test('skips folders whose names start with an underscore', () => {
  const dir = makeDocs({
    '_media/pic.md': '# P\n',
    'guide/_draft/secret.md': '# S\n',
    'guide/ok.md': '# O\n',
  });
  assert.deepEqual(listPages(dir).map((page) => page.rel), ['guide/ok.md']);
});
