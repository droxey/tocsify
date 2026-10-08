'use strict';

const PUNCT = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g;
const EMOJI = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

function slugify(text, seen) {
  let slug = text
    .trim()
    .normalize('NFC')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\uFE0F/g, '')
    .replace(EMOJI, '')
    .replace(/[A-Z]+/g, (letters) => letters.toLowerCase())
    .replace(/<[^>]+>/g, '')
    .replace(PUNCT, '')
    .replace(/\s/g, '-')
    .replace(/^(\d)/, '_$1');
  const count = seen.has(slug) ? seen.get(slug) + 1 : 0;
  seen.set(slug, count);
  return count ? `${slug}-${count}` : slug;
}

function codeMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let fence = null;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^ {0,3}(`{3,}|~{3,})/);
    if (match) {
      const token = match[1];
      const char = token[0];
      const len = token.length;
      if (!fence) {
        fence = { char, len };
        mask[i] = true;
        continue;
      }
      if (char === fence.char && len >= fence.len) {
        mask[i] = true;
        fence = null;
        continue;
      }
    }
    if (fence) mask[i] = true;
  }
  return mask;
}

function parse(markdown) {
  const text = String(markdown).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  const frontmatter = fm ? fm[1] : '';
  const rest = fm ? text.slice(fm[0].length) : text;
  const lines = rest.split('\n');
  const mask = codeMask(lines);
  const headings = [];
  const seen = new Map();
  for (let i = 0; i < lines.length; i += 1) {
    if (mask[i]) continue;
    const line = lines[i];
    const atx = line.match(/^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/);
    let level;
    let raw;
    if (atx) {
      level = atx[1].length;
      raw = atx[2].trim();
    } else if (
      i + 1 < lines.length
      && !mask[i + 1]
      && /^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[i + 1])
      && line.trim()
      && !/^\s*(?:[-*+]|\d+\.)[ \t]/.test(line)
    ) {
      level = lines[i + 1].trim()[0] === '=' ? 1 : 2;
      raw = line.trim();
      i += 1;
    } else {
      continue;
    }
    const idMatch = raw.match(/(?:^|\s):id=(\S+)/);
    headings.push({
      level,
      raw,
      text: raw.replace(/(^|\s):id=\S+/g, '$1').replace(/\s+/g, ' ').trim(),
      id: slugify(idMatch ? idMatch[1] : raw, seen),
      ignore: /\{docsify-ignore\}/.test(raw),
      ignoreAll: false,
    });
  }
  return {
    frontmatter,
    body: rest,
    headings,
    firstParagraph: '',
  };
}

module.exports = { slugify, parse, codeMask };
