
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function resolveBaseUrl({ flag }) {
  if (flag) {
    if (!/^https?:\/\//i.test(flag)) {
      throw new Error('--base-url must start with http:// or https://');
    }
    return flag.endsWith('/') ? flag : `${flag}/`;
  }
  throw new Error('no base url');
}

function buildSite() { throw new Error('buildSite missing'); }
function renderLlmsTxt() { throw new Error('renderLlmsTxt missing'); }
function renderLlmsFull() { throw new Error('renderLlmsFull missing'); }
module.exports = { resolveBaseUrl, buildSite, renderLlmsTxt, renderLlmsFull };
