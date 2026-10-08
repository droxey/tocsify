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

function pageDescription(parsed) {
  const line = parsed.frontmatter.split('\n').find((item) => item.startsWith('description:'));
  if (!line) return '';
  let value = line.slice('description:'.length).trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
    value = value.slice(1, -1);
  }
  return value;
}
function makePage(rel, abs, baseUrl) {
  void baseUrl;
  const parsed = parse(readText(abs));
  return {
    rel,
    abs,
    url: '',
    title: '',
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
function buildSite({ docsDir, baseUrl, exclude = [], title, summary, cwd }) {
  const root = withSlash(baseUrl || '');
  const pages = collectH2Pages(docsDir, root, exclude);
  const groups = groupByH2(pages);
  let resolvedTitle = title || '';
  let resolvedSummary = summary || '';
  const home = findHomePage(docsDir);
  let homeParsed = null;
  if (home && fs.existsSync(path.join(docsDir, home))) homeParsed = parse(readText(path.join(docsDir, home)));
  if (!resolvedTitle) {
    const h1 = homeParsed && homeParsed.headings.find((heading) => heading.level === 1);
    if (h1 && h1.text) resolvedTitle = h1.text;
  }
  if (!resolvedTitle) {
    const pkg = readPkg(cwd);
    if (pkg && typeof pkg.name === 'string' && pkg.name) resolvedTitle = pkg.name;
  }
  if (!resolvedTitle) resolvedTitle = path.basename(docsDir);
  if (!summary) resolvedSummary = homeParsed && homeParsed.firstParagraph ? homeParsed.firstParagraph : '';
  return { title: resolvedTitle, summary: resolvedSummary, baseUrl: root, docsDir, groups };
}
function renderLlmsTxt(site) {
  let out = `# ${site.title}\n`;
  if (site.summary) out += `\n> ${site.summary}\n`;
  return out;
}
function renderLlmsFull() { throw new Error('later'); }
module.exports = { resolveBaseUrl, buildSite, renderLlmsTxt, renderLlmsFull };
