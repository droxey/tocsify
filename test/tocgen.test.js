'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const generate = require('../src/tocgen');

const root = path.join(__dirname, '..');

test('matches docs/toc-test.md byte for byte with maxdepth 3 and no header', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-char-'));
  fs.cpSync(path.join(root, 'docs'), dir, { recursive: true });
  const out = path.join(dir, 'toc-test.md');
  return new Promise((resolve, reject) => {
    generate(dir, { maxdepth: 3, header: false, file: out }, () => {
      try {
        const actual = fs.readFileSync(out, 'utf8');
        const expected = fs.readFileSync(path.join(root, 'docs/toc-test.md'), 'utf8');
        assert.equal(actual, expected);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
});
