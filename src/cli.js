#!/usr/bin/env node
'use strict';

const HELP = `Usage
  $ tocsify [dir] [options]

  dir defaults to docs.

Options
  --file, -f       Path of the table of contents. Default: docs/toc.md
  --maxdepth, -m   Deepest heading level, 1 to 6. Default: 6
  --no-header      Do not prefix page links with ###.
  --verbose, -v    Also print the table of contents to stdout.
  --no-llm         Do not write llms.txt and llms-full.txt.
  --base-url       Site URL for links in the llms files. Detected if not set.
  --title          Title for llms.txt. Default: H1 of the home page
  --summary        Summary for llms.txt. Default: first paragraph of the home page
  --group          h2 or sidebar. Default: h2
  --keep-comments  Keep HTML comments in llms-full.txt.
  --help, -h       Show this help.
  --version        Show the version.

Examples
  $ tocsify docs
  $ tocsify docs --maxdepth=2 --no-header
  $ tocsify docs --base-url=https://example.com/docs/
  $ tocsify docs --no-llm
`;

const fs = require('fs');
const path = require('path');
function run(argv, { stdout }) {
  if (argv.includes('--help') || argv.includes('-h')) {
    stdout.write(HELP);
    return 0;
  }
  if (argv.includes('--version')) {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    stdout.write(`${pkg.version}\n`);
    return 0;
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = run(process.argv.slice(2), {
    cwd: process.cwd(),
    env: process.env,
    stdout: process.stdout,
    stderr: process.stderr,
  });
}
module.exports = { run, HELP };
