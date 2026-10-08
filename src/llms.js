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

function renderLlmsFull(site, { keepComments = false, onWarn } = {}) {
  const warn = onWarn || noop;
  const pages = site.groups.flatMap((group) => group.pages);
  const blocks = pages.map((page) => {
    const body = stripFrontMatterAndFirstH1(readText(page.abs)).trim();
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
