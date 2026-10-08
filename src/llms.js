
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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
  const result = spawnSync('git', ['config', '--get', 'remote.origin.url'], { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('git failed');
  return result.stdout.trim();
}
function resolveBaseUrl({ flag, docsDir, cwd, env = {}, gitRemote = defaultGitRemote }) {
  if (flag) {
    if (!/^https?:\/\//i.test(flag)) throw new Error('--base-url must start with http:// or https://');
    return flag.endsWith('/') ? flag : `${flag}/`;
  }
  let text = '';
  try { text = fs.readFileSync(path.join(docsDir, 'CNAME'), 'utf8'); } catch (err) { text = ''; }
  const line = text.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
  if (line) return `https://${line}/`;
  const repo = env.GITHUB_REPOSITORY;
  if (typeof repo === 'string' && repo.includes('/')) return githubPagesUrl(repo);
  const remote = gitRemote(cwd);
  const mapped = remote ? mapRemote(remote) : '';
  if (mapped) return mapped;
  throw new Error('no base url');
}

function buildSite() { throw new Error('buildSite missing'); }
function renderLlmsTxt() { throw new Error('renderLlmsTxt missing'); }
function renderLlmsFull() { throw new Error('renderLlmsFull missing'); }
module.exports = { resolveBaseUrl, buildSite, renderLlmsTxt, renderLlmsFull };
