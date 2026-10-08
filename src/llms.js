'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parse, codeMask } = require('./headings');
const { listPages, findHomePage } = require('./files');

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function readPkg(cwd) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

function githubPagesUrl(ownerRepo) {
  const slash = ownerRepo.indexOf('/');
  const owner = ownerRepo.slice(0, slash).toLowerCase();
  const repo = ownerRepo.slice(slash + 1).replace(/\.git$/, '');
  if (repo.toLowerCase() === `${owner}.github.io`) return `https://${owner}.github.io/`;
  return `https://${owner}.github.io/${repo}/`;
}

function mapRemote(url) {
  const patterns = [
    /^https:\/\/github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?$/,
    /^git@github\.com:([^/]+)\/([^/\s]+?)(?:\.git)?$/,
    /^ssh:\/\/git@github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?$/,
  ];
  for (const pattern of patterns) {
    const match = String(url).trim().match(pattern);
    if (match) return githubPagesUrl(`${match[1]}/${match[2]}`);
  }
  return '';
}

function defaultGitRemote(cwd) {
  const result = spawnSync('git', ['config', '--get', 'remote.origin.url'], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

function cnameUrl(docsDir) {
  let text;
  try {
    text = fs.readFileSync(path.join(docsDir, 'CNAME'), 'utf8');
  } catch {
    text = '';
  }
  const line = text.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
  return line ? `https://${line}/` : '';
}

function homepageUrl(cwd) {
  const pkg = readPkg(cwd);
  if (!pkg || typeof pkg.homepage !== 'string' || !/^https?:\/\//i.test(pkg.homepage)) return '';
  const bare = pkg.homepage.split('#')[0].split('?')[0];
  return bare.endsWith('/') ? bare : `${bare}/`;
}

function resolveBaseUrl({
  flag, docsDir, cwd, env = {}, gitRemote = defaultGitRemote,
}) {
  if (flag) {
    if (!/^https?:\/\//i.test(flag)) {
      throw new Error('--base-url must start with http:// or https://');
    }
    return flag.endsWith('/') ? flag : `${flag}/`;
  }
  const cname = cnameUrl(docsDir);
  if (cname) return cname;
  const repo = env.GITHUB_REPOSITORY;
  if (typeof repo === 'string' && repo.includes('/')) return githubPagesUrl(repo);
  const remote = gitRemote(cwd);
  const mapped = remote ? mapRemote(remote) : '';
  if (mapped) return mapped;
  const home = homepageUrl(cwd);
  if (home) return home;
  throw new Error('could not detect the site URL. Pass --base-url, for example --base-url=https://example.com/docs/, or use --no-llm.');
}

function withSlash(baseUrl) {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function pageTitle(rel, parsed) {
  const h1 = parsed.headings.find((heading) => heading.level === 1);
  if (h1) return h1.text;
  return rel.replace(/\.md$/, '');
}

function pageDescription(parsed) {
  const line = parsed.frontmatter.split('\n').find((item) => item.startsWith('description:'));
  if (line) {
    let value = line.slice('description:'.length).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1);
    }
    return value;
  }
  if (!parsed.firstParagraph) return '';
  const sentence = parsed.firstParagraph.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return sentence ? sentence[0] : parsed.firstParagraph;
}

function makePage(rel, abs, baseUrl) {
  const parsed = parse(readText(abs));
  const root = withSlash(baseUrl);
  return {
    rel,
    abs,
    url: new URL(encodeURI(rel), root).href,
    title: pageTitle(rel, parsed),
    description: pageDescription(parsed),
    ignoreAll: parsed.headings.some((heading) => heading.ignoreAll),
  };
}

function groupByH2(pages) {
  const groups = [];
  const index = new Map();
  for (const page of pages) {
    const dir = path.posix.dirname(page.rel);
    const name = dir === '.' ? 'Docs' : dir;
    if (!index.has(name)) {
      const group = { name, pages: [] };
      index.set(name, group);
      groups.push(group);
    }
    index.get(name).pages.push(page);
  }
  return groups;
}

function parseSidebar(text) {
  const sections = [];
  let current = null;
  for (const line of text.split('\n')) {
    const match = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (!match) continue;
    const indent = match[1].length;
    const body = match[2].trim();
    const link = body.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
    if (indent === 0 && !link) {
      current = { name: body, links: [] };
      sections.push(current);
      continue;
    }
    if (!link) continue;
    if (!current) {
      current = { name: 'Docs', links: [] };
      sections.unshift(current);
    }
    current.links.push(link[2].trim());
  }
  return sections;
}

function sidebarTarget(target) {
  const clean = target.split('#')[0].split('?')[0].trim();
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(clean)) return { external: true };
  let rel = clean;
  if (rel.startsWith('/')) rel = rel.slice(1);
  if (rel === '' || rel.endsWith('/')) rel += 'README.md';
  else if (!path.posix.extname(rel)) rel += '.md';
  return { rel };
}

function groupBySidebar(docsDir, baseUrl, exclude, onWarn) {
  const sidebarPath = path.join(docsDir, '_sidebar.md');
  if (!fs.existsSync(sidebarPath)) throw new Error('sidebar file not found: _sidebar.md');
  const sections = parseSidebar(readText(sidebarPath));
  const excluded = new Set(exclude.map((item) => path.resolve(item)));
  const seen = new Set();
  const groups = [];
  function bucket(name) {
    let group = groups.find((item) => item.name === name);
    if (!group) {
      group = { name, pages: [] };
      groups.push(group);
    }
    return group;
  }
  for (const section of sections) {
    for (const target of section.links) {
      const resolved = sidebarTarget(target);
      if (resolved.external) continue;
      if (resolved.rel.split('/').some((seg) => seg.startsWith('_') || seg.startsWith('.'))) continue;
      const abs = path.resolve(docsDir, resolved.rel);
      if (excluded.has(abs)) continue;
      if (seen.has(abs)) continue;
      if (!fs.existsSync(abs)) {
        onWarn(`sidebar link not found: ${resolved.rel}`);
        continue;
      }
      const page = makePage(resolved.rel, abs, baseUrl);
      if (page.ignoreAll) continue;
      seen.add(abs);
      bucket(section.name).pages.push(page);
    }
  }
  const home = findHomePage(docsDir);
  if (home) {
    const abs = path.resolve(docsDir, home);
    if (!seen.has(abs) && !excluded.has(abs)) {
      const page = makePage(home, abs, baseUrl);
      if (!page.ignoreAll) {
        let docs = groups.find((item) => item.name === 'Docs');
        if (!docs) {
          docs = { name: 'Docs', pages: [] };
          groups.unshift(docs);
        }
        docs.pages.unshift(page);
      }
    }
  }
  return groups.filter((group) => group.pages.length > 0);
}

function collectH2Pages(docsDir, baseUrl, exclude) {
  const excluded = new Set(exclude.map((item) => path.resolve(item)));
  const pages = [];
  const home = findHomePage(docsDir);
  if (home) {
    const abs = path.resolve(docsDir, home);
    if (!excluded.has(abs)) pages.push(makePage(home, abs, baseUrl));
  }
  for (const page of listPages(docsDir, { exclude })) {
    pages.push(makePage(page.rel, page.abs, baseUrl));
  }
  return pages.filter((page) => !page.ignoreAll);
}

function buildSite({
  docsDir, baseUrl, exclude = [], group = 'h2', title, summary, onWarn, cwd,
}) {
  const warn = onWarn || noop;
  const root = withSlash(baseUrl);
  const groups = group === 'sidebar'
    ? groupBySidebar(docsDir, root, exclude, warn)
    : groupByH2(collectH2Pages(docsDir, root, exclude));
  const homeRel = findHomePage(docsDir);
  let homeParsed = null;
  if (homeRel && fs.existsSync(path.join(docsDir, homeRel))) {
    homeParsed = parse(readText(path.join(docsDir, homeRel)));
  }
  let resolvedTitle = title;
  if (!resolvedTitle) {
    const h1 = homeParsed && homeParsed.headings.find((heading) => heading.level === 1);
    if (h1 && h1.text) resolvedTitle = h1.text;
  }
  if (!resolvedTitle) {
    const pkg = readPkg(cwd);
    if (pkg && typeof pkg.name === 'string' && pkg.name) resolvedTitle = pkg.name;
  }
  if (!resolvedTitle) resolvedTitle = path.basename(docsDir);
  let resolvedSummary = summary || '';
  if (!summary) {
    resolvedSummary = homeParsed && homeParsed.firstParagraph ? homeParsed.firstParagraph : '';
  }
  const publicGroups = groups.map((item) => ({
    name: item.name,
    pages: item.pages.map((page) => ({
      rel: page.rel,
      abs: page.abs,
      url: page.url,
      title: page.title,
      description: page.description,
    })),
  }));
  return {
    title: resolvedTitle,
    summary: resolvedSummary,
    baseUrl: root,
    docsDir,
    groups: publicGroups,
  };
}

function renderLlmsTxt(site) {
  let out = `# ${site.title}\n`;
  if (site.summary) out += `\n> ${site.summary}\n`;
  for (const group of site.groups) {
    out += `\n## ${group.name}\n\n`;
    for (const page of group.pages) {
      const desc = page.description ? `: ${page.description}` : '';
      out += `- [${page.title}](${page.url})${desc}\n`;
    }
  }
  const fullUrl = new URL('llms-full.txt', site.baseUrl).href;
  out += `\n## Optional\n\n- [llms-full.txt](${fullUrl}): Full text of every page in one file\n`;
  return out;
}

function noop() {}

function stripFrontMatterAndFirstH1(text) {
  const fm = text.match(/^---\n[\s\S]*?\n---\n/);
  const rest = fm ? text.slice(fm[0].length) : text;
  const lines = rest.split('\n');
  const mask = codeMask(lines);
  for (let i = 0; i < lines.length; i += 1) {
    if (mask[i] || /^\s*>/.test(lines[i])) continue;
    const atx = lines[i].match(/^ {0,3}(#{1,6})[ \t]/);
    if (atx && atx[1].length === 1) {
      lines.splice(i, 1);
      break;
    }
    if (
      i + 1 < lines.length
      && !mask[i + 1]
      && /^ {0,3}=+[ \t]*$/.test(lines[i + 1])
      && lines[i].trim()
      && !/^\s*(?:[-*+]|\d+\.)[ \t]/.test(lines[i])
    ) {
      lines.splice(i, 2);
      break;
    }
  }
  return lines.join('\n');
}

function stripIgnoreMarkers(text) {
  return text
    .replace(/[ \t]*<!--\s*\{docsify-ignore(?:-all)?\}\s*-->/g, '')
    .replace(/[ \t]*\{docsify-ignore(?:-all)?\}/g, '');
}

// Docsify 5 with relativePath: false (checked in headless Chrome against docsify@5.0.0):
// markdown links load from the docs root, markdown images load from the routed page's folder,
// and raw HTML src and href resolve against index.html, which is the docs root.
function fileFolder(rel) {
  const dir = path.posix.dirname(rel);
  return dir === '.' ? '' : dir;
}

function isRelative(url) {
  if (url.startsWith('#') || url.startsWith('//')) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return false;
  return true;
}

function absolute(url, baseUrl, folder) {
  if (url.startsWith('/')) return new URL(url.replace(/^\/+/, ''), baseUrl).href;
  return new URL(url, `${baseUrl}${folder ? `${folder}/` : ''}`).href;
}

function splitSuffix(url) {
  const at = url.search(/[?#]/);
  return at === -1 ? [url, ''] : [url.slice(0, at), url.slice(at)];
}

function docsifyPagePath(file) {
  if (file === '' || file.endsWith('/')) return `${file}README.md`;
  if (path.posix.extname(file)) return file;
  return `${file}.md`;
}

function linkTarget(url, ctx) {
  if (!isRelative(url)) return url;
  const [file, suffix] = splitSuffix(url);
  return absolute(`${docsifyPagePath(file)}${suffix}`, ctx.baseUrl, '');
}

function imageTarget(url, ctx) {
  if (!isRelative(url)) return url;
  return absolute(url, ctx.baseUrl, fileFolder(ctx.pageRel));
}

function htmlTarget(url, ctx) {
  if (!isRelative(url)) return url;
  return absolute(url, ctx.baseUrl, '');
}

const DEST = '(<[^>\\n]*>|[^)\\s]+)';
const LINK = new RegExp(`\\[([^\\]]*)\\]\\(${DEST}([^)]*)\\)`, 'g');
const IMAGE = new RegExp(`!\\[([^\\]]*)\\]\\(${DEST}([^)]*)\\)`, 'g');
const BADGE = new RegExp(`\\[!\\[([^\\]]*)\\]\\(${DEST}([^)]*)\\)\\]\\(${DEST}([^)]*)\\)`, 'g');
const REF_DEF = /^( {0,3}\[([^\]]+)\]:[ \t]*)(<[^>\n]*>|\S+)/gm;
const IMG_SRC = /(<img\b[^>]*\bsrc\s*=\s*)(?:(["'])([^"']+)\2|([^\s"'>]+))/gi;
const A_HREF = /(<a\b[^>]*\bhref\s*=\s*)(?:(["'])([^"']+)\2|([^\s"'>]+))/gi;

function mapDest(dest, target, ctx) {
  if (/^<[^>]*>$/.test(dest)) {
    const inner = dest.slice(1, -1);
    return isRelative(inner) ? target(inner, ctx) : dest;
  }
  return target(dest, ctx);
}

function refKey(label) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function imageRefKeys(text) {
  const keys = new Set();
  for (const match of text.matchAll(/!\[([^\]]*)\](?:\[([^\]]*)\]|(?![(:]))/g)) {
    keys.add(refKey(match[2] || match[1]));
  }
  return keys;
}

function rewritePlain(text, ctx) {
  const link = (url) => mapDest(url, linkTarget, ctx);
  const image = (url) => mapDest(url, imageTarget, ctx);
  const slots = [];
  const hold = (value) => {
    slots.push(value);
    return `%%LLMS_SLOT_${slots.length - 1}%%`;
  };
  let next = text.replace(BADGE, (full, alt, src, srcRest, href, hrefRest) => (
    hold(`[![${alt}](${image(src)}${srcRest})](${link(href)}${hrefRest})`)
  ));
  next = next.replace(IMAGE, (full, alt, url, rest) => hold(`![${alt}](${image(url)}${rest})`));
  next = next.replace(LINK, (full, label, url, rest) => `[${label}](${link(url)}${rest})`);
  next = next.replace(/%%LLMS_SLOT_(\d+)%%/g, (full, index) => slots[Number(index)]);
  next = next.replace(REF_DEF, (full, pre, label, url) => {
    const target = ctx.imageRefs.has(refKey(label)) ? imageTarget : linkTarget;
    return `${pre}${mapDest(url, target, ctx)}`;
  });
  const html = (full, pre, quote, quoted, bare) => (
    quote ? `${pre}${quote}${htmlTarget(quoted, ctx)}${quote}` : `${pre}${htmlTarget(bare, ctx)}`
  );
  next = next.replace(IMG_SRC, html).replace(A_HREF, html);
  return next;
}

function splitByFence(text) {
  const lines = text.split('\n');
  const mask = codeMask(lines);
  const parts = [];
  let start = 0;
  let mode = mask[0];
  for (let i = 1; i <= lines.length; i += 1) {
    if (i === lines.length || mask[i] !== mode) {
      parts.push({ code: mode, value: lines.slice(start, i).join('\n') });
      start = i;
      mode = mask[i];
    }
  }
  return parts;
}

function splitInline(text) {
  const parts = [];
  let i = 0;
  while (i < text.length) {
    const tick = text.indexOf('`', i);
    if (tick === -1) {
      parts.push({ code: false, value: text.slice(i) });
      break;
    }
    let j = tick;
    while (j < text.length && text[j] === '`') j += 1;
    const marker = text.slice(tick, j);
    const end = text.indexOf(marker, j);
    if (end === -1) {
      parts.push({ code: false, value: text.slice(i) });
      break;
    }
    if (tick > i) parts.push({ code: false, value: text.slice(i, tick) });
    parts.push({ code: true, value: text.slice(tick, end + marker.length) });
    i = end + marker.length;
  }
  return parts;
}

function outsideCode(text, fn) {
  return splitByFence(text).map((part) => {
    if (part.code) return part.value;
    return splitInline(part.value).map((item) => (item.code ? item.value : fn(item.value))).join('');
  }).join('\n');
}

function includeMode(url, title) {
  const typeMatch = title.match(/:type=(\S+)/);
  const type = typeMatch ? typeMatch[1] : '';
  if (type === 'code') return 'code';
  const clean = url.split('#')[0].split('?')[0];
  if (type === 'markdown' || (!type && /\.(md|markdown)$/i.test(clean))) return 'markdown';
  return 'link';
}

function resolveLocal(url, ctx) {
  const clean = url.split('#')[0].split('?')[0];
  const abs = clean.startsWith('/')
    ? path.resolve(ctx.docsDir, clean.slice(1))
    : path.resolve(path.dirname(ctx.abs), clean);
  const relToDocs = path.relative(path.resolve(ctx.docsDir), abs);
  if (relToDocs.startsWith('..')) return { outside: true };
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return { missing: true };
  return { abs, rel: relToDocs.split(path.sep).join('/') };
}

function codeFence(content, ext) {
  const ticks = content.match(/`+/g);
  let longest = 0;
  if (ticks) {
    for (const run of ticks) {
      if (run.length > longest) longest = run.length;
    }
  }
  const fence = '`'.repeat(Math.max(3, longest + 1));
  const body = content.replace(/\s+$/, '');
  return `${fence}${ext}\n${body}\n${fence}`;
}

function findNextLink(text, from) {
  for (let i = from; i < text.length; i += 1) {
    if (text[i] !== '[') continue;
    if (text[i - 1] === '!') continue;
    const close = text.indexOf(']', i + 1);
    if (close === -1 || text[close + 1] !== '(') continue;
    let j = close + 2;
    while (j < text.length && text[j] === ' ') j += 1;
    const urlStart = j;
    while (j < text.length && text[j] !== ')' && text[j] !== ' ' && text[j] !== '\n') j += 1;
    const url = text.slice(urlStart, j);
    while (j < text.length && text[j] === ' ') j += 1;
    let title = '';
    if (text[j] === '"' || text[j] === "'") {
      const quote = text[j];
      const titleEnd = text.indexOf(quote, j + 1);
      if (titleEnd === -1) continue;
      title = text.slice(j + 1, titleEnd);
      j = titleEnd + 1;
      while (j < text.length && text[j] === ' ') j += 1;
    }
    if (text[j] !== ')') continue;
    return {
      start: i,
      end: j + 1,
      url,
      title,
      raw: text.slice(i, j + 1),
    };
  }
  return null;
}

// An include that stays a link points where Docsify fetches it: the including file's folder.
function includeLink(link, ctx) {
  const at = link.raw.indexOf(link.url, link.raw.indexOf(']('));
  const url = absolute(link.url, ctx.baseUrl, fileFolder(ctx.rel));
  return `${link.raw.slice(0, at)}${url}${link.raw.slice(at + link.url.length)}`;
}

function renderInclude(link, ctx) {
  if (!link.title.includes(':include')) return link.raw;
  if (!isRelative(link.url)) return link.raw;
  const mode = includeMode(link.url, link.title);
  const resolved = resolveLocal(link.url, ctx);
  if (resolved.outside) {
    ctx.onWarn(`include is outside the docs folder: ${link.url}`);
    return includeLink(link, ctx);
  }
  if (resolved.missing) {
    ctx.onWarn(`missing include: ${link.url}`);
    return includeLink(link, ctx);
  }
  if (mode === 'link') return includeLink(link, ctx);
  if (mode === 'code') {
    return codeFence(readText(resolved.abs), path.posix.extname(resolved.rel).slice(1));
  }
  const included = readText(resolved.abs);
  return transform(included, { ...ctx, inlined: true });
}

function expandIncludes(text, ctx) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const link = findNextLink(text, i);
    if (!link) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, link.start);
    out += renderInclude(link, ctx);
    i = link.end;
  }
  return out;
}

function transformPlain(text, ctx) {
  let next = stripIgnoreMarkers(text);
  if (!ctx.inlined) next = expandIncludes(next, ctx);
  return outsideCode(next, (value) => rewritePlain(value, ctx));
}

function transform(text, ctx) {
  const local = { ...ctx, imageRefs: imageRefKeys(text) };
  return outsideCode(text, (value) => transformPlain(value, local));
}

function processBody(page, site, options) {
  const text = stripFrontMatterAndFirstH1(readText(page.abs));
  return transform(text, {
    docsDir: site.docsDir,
    baseUrl: site.baseUrl,
    abs: page.abs,
    rel: page.rel,
    pageRel: page.rel,
    keepComments: Boolean(options.keepComments),
    onWarn: options.onWarn,
  }).trim();
}

function renderLlmsFull(site, { keepComments = false, onWarn } = {}) {
  const warn = onWarn || noop;
  const pages = site.groups.flatMap((group) => group.pages);
  const blocks = pages.map((page) => {
    const body = processBody(page, site, { keepComments, onWarn: warn });
    return `# ${page.title}\nSource: ${page.url}\n\n${body}`;
  });
  return `${blocks.join('\n\n')}\n`;
}

module.exports = {
  resolveBaseUrl,
  buildSite,
  renderLlmsTxt,
  renderLlmsFull,
};
