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

test('slugify matches Docsify 5 ids for the 11 edge-case headings', () => {
  const parsed = parse(fs.readFileSync(path.join(root, 'test/fixtures/headings/edge.md'), 'utf8'));
  assert.deepEqual(parsed.headings.map((heading) => heading.id), [
    'edge-cases',
    '_1-first-step',
    'café-olé',
    'c--c',
    'emoji--rocket',
    'hello-world',
    'link-text',
    'duplicate',
    'duplicate-1',
    'use-npm-i',
    'setext-two',
  ]);
  assert.equal(parsed.headings.some((heading) => heading.raw.includes('not a heading')), false);
});

test('slugify keeps non-ASCII uppercase in Ünïcödé Ñame', () => {
  assert.equal(slugify('Ünïcödé Ñame', new Map()), 'Ünïcödé-Ñame');
});

test('duplicate headings get -1 and -2 suffixes', () => {
  const parsed = parse('# Duplicate\n# Duplicate\n# Duplicate\n');
  assert.deepEqual(parsed.headings.map((heading) => heading.id), [
    'duplicate',
    'duplicate-1',
    'duplicate-2',
  ]);
});

test('ignored and deep headings count toward duplicate numbering', () => {
  const parsed = parse([
    '# Duplicate',
    '# Duplicate {docsify-ignore}',
    '# Duplicate {docsify-ignore}',
    '###### Duplicate',
    '# Duplicate',
  ].join('\n'));
  assert.deepEqual(parsed.headings.map((heading) => heading.id), [
    'duplicate',
    'duplicate-docsify-ignore',
    'duplicate-docsify-ignore-1',
    'duplicate-1',
    'duplicate-2',
  ]);
  assert.equal(parsed.headings[1].ignore, true);
  assert.equal(parsed.headings[2].ignore, true);
  assert.equal(parsed.headings[3].level, 6);
});

test(':id= sets the id and is removed from the text', () => {
  const parsed = parse('# Hello, world! :id=custom-id\n');
  assert.equal(parsed.headings[0].id, 'custom-id');
  assert.equal(parsed.headings[0].text, 'Hello, world!');
});

test('headings inside backtick and tilde fences are skipped', () => {
  const parsed = parse('```\n## nope\n```\n~~~\n## also nope\n~~~\n# Yes\n');
  assert.deepEqual(parsed.headings.map((heading) => heading.text), ['Yes']);
});

test('a fence closes only on the same character at equal or greater length', () => {
  const parsed = parse('````\n```\n## inside\n````\n# After\n~~~\n## tilde\n```\n## stays in tilde\n~~~\n# Done\n');
  assert.deepEqual(parsed.headings.map((heading) => heading.text), ['After', 'Done']);
});

test('setext headings parse as level 1 and level 2', () => {
  const parsed = parse('Top\n===\n\nSub\n---\n');
  assert.deepEqual(parsed.headings.map((heading) => [heading.level, heading.id]), [
    [1, 'top'],
    [2, 'sub'],
  ]);
});

test('a list item above --- is not a setext heading', () => {
  const parsed = parse('- item\n---\n# Real\n');
  assert.deepEqual(parsed.headings.map((heading) => heading.text), ['Real']);
});

test('closing hashes are removed from ATX headings', () => {
  const parsed = parse('## Hello ##\n');
  assert.equal(parsed.headings[0].text, 'Hello');
  assert.equal(parsed.headings[0].id, 'hello');
});

test('front matter is skipped and returned', () => {
  const parsed = parse('---\ndescription: "Hi"\n---\n# Title\n');
  assert.equal(parsed.frontmatter, 'description: "Hi"');
  assert.equal(parsed.headings[0].text, 'Title');
  assert.equal(parsed.body.startsWith('# Title'), true);
});

test('CRLF and a leading BOM parse the same as LF', () => {
  const lf = parse('# Title\n\nHello.\n');
  const crlf = parse('\uFEFF# Title\r\n\r\nHello.\r\n');
  assert.deepEqual(crlf.headings, lf.headings);
  assert.equal(crlf.firstParagraph, lf.firstParagraph);
});

test('both ignore forms set ignore and both ignore-all forms set ignoreAll', () => {
  const parsed = parse([
    '# A {docsify-ignore}',
    '# B <!-- {docsify-ignore} -->',
    '# C {docsify-ignore-all}',
    '# D <!-- {docsify-ignore-all} -->',
  ].join('\n'));
  assert.deepEqual(parsed.headings.map((heading) => [heading.ignore, heading.ignoreAll]), [
    [true, false],
    [true, false],
    [false, true],
    [false, true],
  ]);
});

test('heading text drops markers, :id=, link syntax, and HTML tags', () => {
  const parsed = parse('# See [Docs](https://example.com) <em>now</em> :id=clean <!-- {docsify-ignore} -->\n');
  assert.equal(parsed.headings[0].text, 'See Docs now');
  assert.equal(parsed.headings[0].id, 'clean');
});

test('blockquote lines are not headings', () => {
  const parsed = parse('> # Not ATX\n> Quote title\n---\n# Real\n');
  assert.deepEqual(parsed.headings.map((heading) => heading.text), ['Real']);
});

test('first paragraph skips badge-only lines, notices, lists, and code', () => {
  const parsed = parse([
    '```',
    '# Fake',
    '```',
    '## Second',
    '# Real Title',
    '',
    '[![npm](https://img.example/badge.svg)](https://example.com)',
    '',
    '!> A notice',
    '?> A tip',
    '- a list',
    '> a quote',
    '| a | table |',
    '<br>',
    '',
    '```',
    'code',
    '```',
    '',
    'The real paragraph is here. More text.',
  ].join('\n'));
  assert.equal(parsed.firstParagraph, 'The real paragraph is here. More text.');
  const noH1 = parse('Just words without a stop\n');
  assert.equal(noH1.firstParagraph, 'Just words without a stop');
});
