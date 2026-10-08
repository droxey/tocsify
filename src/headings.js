'use strict';

function slugify(text, seen) {
  void seen;
  return text.trim().toLowerCase().replace(/[{}]/g, '').replace(/\s+/g, '-');
}

function codeMask(lines) {
  return new Array(lines.length).fill(false);
}

function parse(markdown) {
  const headings = [];
  const seen = new Map();
  for (const line of String(markdown).split('\n')) {
    const atx = line.match(/^ {0,3}(#{1,6})[ \t]+(.*)$/);
    if (!atx) continue;
    const raw = atx[2].trim();
    headings.push({
      level: atx[1].length,
      raw,
      text: raw,
      id: slugify(raw, seen),
      ignore: false,
      ignoreAll: false,
    });
  }
  return {
    frontmatter: '',
    body: String(markdown),
    headings,
    firstParagraph: '',
  };
}

module.exports = { slugify, parse, codeMask };
