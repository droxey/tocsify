'use strict';

function resolveBaseUrl({ flag }) {
  if (!flag) throw new Error('no base url');
  return flag.endsWith('/') ? flag : `${flag}/`;
}

function buildSite() { throw new Error('buildSite missing'); }
function renderLlmsTxt() { throw new Error('renderLlmsTxt missing'); }
function renderLlmsFull() { throw new Error('renderLlmsFull missing'); }

module.exports = { resolveBaseUrl, buildSite, renderLlmsTxt, renderLlmsFull };
