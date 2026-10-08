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


function buildSite({ docsDir, baseUrl }) {
  const home = findHomePage(docsDir);
  let title = '';
  let summary = '';
  const pages = [];
  if (home && fs.existsSync(path.join(docsDir, home))) {
    const abs = path.join(docsDir, home);
    const parsed = parse(readText(abs));
    const h1 = parsed.headings.find((heading) => heading.level === 1);
    title = h1 ? h1.text : '';
    summary = parsed.firstParagraph || '';
    pages.push({ rel: home, abs, url: '', title, description: '' });
  }
  return { title, summary, groups: [{ name: 'Docs', pages }], baseUrl: baseUrl || '', docsDir };
}
function renderLlmsTxt() { throw new Error('renderLlmsTxt missing'); }
function renderLlmsFull() { throw new Error('renderLlmsFull missing'); }
module.exports = { resolveBaseUrl, buildSite, renderLlmsTxt, renderLlmsFull };
