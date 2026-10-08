
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function resolveBaseUrl({ flag, docsDir, env = {} }) {
  if (flag) {
    if (!/^https?:\/\//i.test(flag)) throw new Error('--base-url must start with http:// or https://');
    return flag.endsWith('/') ? flag : `${flag}/`;
  }
  let text = '';
  try { text = fs.readFileSync(path.join(docsDir, 'CNAME'), 'utf8'); } catch (err) { text = ''; }
  const line = text.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
  if (line) return `https://${line}/`;
  if (typeof env.GITHUB_REPOSITORY === 'string' && env.GITHUB_REPOSITORY.includes('/')) {
    const repo = env.GITHUB_REPOSITORY;
    const slash = repo.indexOf('/');
    const owner = repo.slice(0, slash).toLowerCase();
    const name = repo.slice(slash + 1);
    if (name.toLowerCase() === `${owner}.github.io`) return `https://${owner}.github.io/`;
    return `https://${owner}.github.io/${name}/`;
  }
  throw new Error('no base url');
}

function buildSite() { throw new Error('buildSite missing'); }
function renderLlmsTxt() { throw new Error('renderLlmsTxt missing'); }
function renderLlmsFull() { throw new Error('renderLlmsFull missing'); }
module.exports = { resolveBaseUrl, buildSite, renderLlmsTxt, renderLlmsFull };
