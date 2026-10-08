'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { parse, slugify } = require('../src/headings');

const root = path.join(__dirname, '..');

function idsOf(file) {
  return parse(fs.readFileSync(file, 'utf8')).headings.map((heading) => heading.id);
}

test('slugify matches Docsify 5 ids for the 23 existing fixture headings', () => {
  const guide = path.join(root, 'docs/test/markdown-guide.md');
  const file = path.join(root, 'docs/test/test-file.md');
  assert.deepEqual(idsOf(guide).concat(idsOf(file)), [
    'markdown',
    'headings',
    'heading-1-docsify-ignore',
    'heading-2-docsify-ignore',
    'heading-3-docsify-ignore',
    'heading-4-docsify-ignore',
    'text',
    'links',
    'lists',
    'blockquotes',
    'code',
    'notices',
    'tables',
    'keyboard',
    'horizontal-rule',
    'images',
    'emoji',
    'test-file',
    'header-2',
    'header-3',
    'header-4',
    'header-5',
    'header-6',
  ]);
});
