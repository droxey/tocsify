
'use strict';
const fs = require('fs');
const path = require('path');
function listPages(docsDir, { exclude = [] } = {}) {
  const excluded = new Set(exclude.map((item) => path.resolve(item)));
  const names = fs.readdirSync(docsDir, { recursive: true });
  const pages = [];
  for (const name of names) {
    const rel = String(name).split(path.sep).join('/');
    const abs = path.resolve(docsDir, rel);
    if (!fs.statSync(abs).isFile()) continue;
    
    pages.push({ rel, abs });
  }
  pages.sort((a, b) => a.rel.localeCompare(b.rel, 'en'));
  return pages;
}
function findHomePage() { return null; }
module.exports = { listPages, findHomePage };
