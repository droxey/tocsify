'use strict';

// Docsify 5 punctuation class from src/core/render/slugify.js (docsify@5.0.0).
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

function normalize(markdown) {
  return String(markdown).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function headingText(raw) {
  return raw
    .replace(/[ \t]*<!--\s*\{docsify-ignore(?:-all)?\}\s*-->/g, '')
    .replace(/[ \t]*\{docsify-ignore(?:-all)?\}/g, '')
    .replace(/(^|\s):id=\S+/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasIgnore(raw) {
  if (/<!--\s*\{docsify-ignore\}\s*-->/.test(raw)) return true;
  return /\{docsify-ignore\}/.test(raw);
}

function hasIgnoreAll(raw) {
  if (/<!--\s*\{docsify-ignore-all\}\s*-->/.test(raw)) return true;
  return /\{docsify-ignore-all\}/.test(raw);
}

function onlyMedia(raw) {
  const left = raw
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*:include[^)]*\)/g, '')
    .trim();
  return left.length === 0;
}

function plainText(raw) {
  return raw
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`+/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isStructural(line) {
  if (/^ {0,3}#{1,6}[ \t]/.test(line)) return true;
  if (/^\s*(?:[-*+]|\d+\.)[ \t]/.test(line)) return true;
  if (/^\s*>/.test(line)) return true;
  if (/^\s*[!?]>\s?/.test(line)) return true;
  if (line.includes('|')) return true;
  if (/^\s*<[^>]+>\s*$/.test(line)) return true;
  return false;
}

function firstParagraph(body) {
  const lines = body.split('\n');
  const mask = codeMask(lines);
  let start = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (mask[i]) continue;
    const atx = lines[i].match(/^ {0,3}(#{1,6})[ \t]/);
    if (atx && atx[1].length === 1) {
      start = i + 1;
      break;
    }
  }
  const buf = [];
  function take() {
    if (!buf.length) return '';
    const raw = buf.join(' ');
    buf.length = 0;
    if (onlyMedia(raw)) return '';
    return plainText(raw);
  }
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    if (mask[i] || isStructural(line)) {
      const got = take();
      if (got) return got;
      continue;
    }
    if (!line.trim()) {
      const got = take();
      if (got) return got;
      continue;
    }
    buf.push(line.trim());
  }
  return take();
}

function parse(markdown) {
  const text = normalize(markdown);
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
    if (/^\s*>/.test(line)) continue;
    const atx = line.match(/^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/);
    let level;
    let raw;
    if (atx) {
      level = atx[1].length;
      raw = atx[2];
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
      text: headingText(raw),
      id: slugify(idMatch ? idMatch[1] : raw, seen),
      ignore: hasIgnore(raw),
      ignoreAll: hasIgnoreAll(raw),
    });
  }
  return {
    frontmatter,
    body: rest,
    headings,
    firstParagraph: firstParagraph(rest),
  };
}

module.exports = {
  slugify,
  parse,
  codeMask,
};
