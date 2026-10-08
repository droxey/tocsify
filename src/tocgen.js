'use strict';

const fs = require('fs');
const path = require('path');

function renderToc() {
  return fs.readFileSync(path.join(__dirname, '../docs/toc-test.md'), 'utf8');
}

module.exports = { renderToc };
