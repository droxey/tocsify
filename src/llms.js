
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function resolveBaseUrl({ flag, docsDir }) {
  if (flag) {
    if (!/^https?:\/\//i.test(flag)) {
      throw new Error('--base-url must start with http:// or https://');
    }
    return flag.endsWith('/') ? flag : `${flag}/`;
  }
  let text = '';
  try { text = fs.readFileSync(path.join(docsDir, 'CNAME'), 'utf8'); } catch (err) { text = ''; }
  const line = text.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
  if (line) return `https://${line}/`;
  throw new Error('no base url');
}

function buildSite() { throw new Error('buildSite missing'); }
function renderLlmsTxt() { throw new Error('renderLlmsTxt missing'); }
function renderLlmsFull() { throw new Error('renderLlmsFull missing'); }
module.exports = { resolveBaseUrl, buildSite, renderLlmsTxt, renderLlmsFull };
