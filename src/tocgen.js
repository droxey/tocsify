'use strict';

const fs = require('fs');
const path = require('path');
const { parse, slugify } = require('./headings');

const BULLETS = ['-', '*', '+'];

function renderToc(pages, { maxdepth = 3, header = true } = {}) {
  let out = '';
  for (const page of pages) {
    const parsed = parse(fs.readFileSync(page.abs, 'utf8'));
    if (parsed.headings.some((heading) => heading.raw.includes('{docsify-ignore-all}') && !heading.raw.includes('<!--'))) continue;
    const base = path.posix.basename(page.rel, '.md');
    const fileSlug = slugify(base, new Map());
    const levels = parsed.headings.map((heading) => heading.level);
    const minLevel = 1;
    const items = [];
    for (const heading of parsed.headings) {
      if (heading.level > maxdepth) continue;
      if (heading.raw.includes('{docsify-ignore}') && !heading.raw.includes('<!--')) continue;
      if (heading.level === 1 && heading.id === fileSlug) continue;
      const depth = heading.level - minLevel;
      const indent = '  '.repeat(depth);
      const bullet = BULLETS[depth % 3];
      items.push(`${indent}${bullet} [${heading.text}](${page.rel}#${heading.id})`);
    }
    const prefix = header ? '### ' : '';
    const link = `${prefix}[${page.rel.replace(/\.md$/, '')}](${page.rel})`;
    out += `${link}\n${items.join('\n')}${items.length ? '\n' : ''}\n`;
  }
  return out;
}

module.exports = { renderToc };
