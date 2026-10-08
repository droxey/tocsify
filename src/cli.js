#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');
const { listPages } = require('./files');
const { renderToc } = require('./tocgen');
const { resolveBaseUrl, buildSite, renderLlmsTxt, renderLlmsFull } = require('./llms');

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

const OPTIONS = {
  file: { type: 'string', short: 'f', default: 'docs/toc.md' },
  maxdepth: { type: 'string', short: 'm', default: '6' },
  header: { type: 'boolean', default: true },
  verbose: { type: 'boolean', short: 'v', default: false },
  llm: { type: 'boolean', default: true },
  'base-url': { type: 'string' },
  title: { type: 'string' },
  summary: { type: 'string' },
  group: { type: 'string', default: 'h2' },
  'keep-comments': { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', default: false },
};

function rewriteHeaderArgs(argv) {
  return argv.map((arg) => {
    if (arg === '--header=false') return '--no-header';
    if (arg === '--header=true') return '--header';
    return arg;
  });
}

function run(argv, {
  cwd, env, stdout, stderr,
}) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      strict: true,
      allowNegative: true,
      allowPositionals: true,
      options: OPTIONS,
    });
  } catch (err) {
    stderr.write(`[tocsify] error: ${err.message}\n`);
    return 1;
  }
  if (parsed.values.help) {
    stdout.write(HELP);
    return 0;
  }
  if (parsed.values.version) {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    stdout.write(`${pkg.version}\n`);
    return 0;
  }
  if (parsed.positionals.length > 1) {
    stderr.write('[tocsify] error: too many arguments\n');
    return 1;
  }
  const dirArg = parsed.positionals[0] || 'docs';
  const docsDir = path.resolve(cwd, dirArg);
  if (!/^[1-6]$/.test(parsed.values.maxdepth)) {
    stderr.write('[tocsify] error: --maxdepth must be an integer from 1 to 6\n');
    return 1;
  }
  const fileAbs = path.resolve(cwd, parsed.values.file);
  const warnings = [];
  const onWarn = (message) => warnings.push(message);
  let toc;
  let llms = null;
  let full = null;
  try {
    const pages = listPages(docsDir, { exclude: [fileAbs] });
    toc = renderToc(pages, {
      maxdepth: Number(parsed.values.maxdepth),
      header: parsed.values.header,
    });
    if (parsed.values.llm !== false) {
      const baseUrl = resolveBaseUrl({
        flag: parsed.values['base-url'],
        docsDir,
        cwd,
        env,
      });
      const site = buildSite({
        docsDir,
        baseUrl,
        exclude: [fileAbs],
        group: parsed.values.group,
        title: parsed.values.title,
        summary: parsed.values.summary,
        onWarn,
        cwd,
      });
      llms = renderLlmsTxt(site);
      full = renderLlmsFull(site, {
        keepComments: parsed.values['keep-comments'],
        onWarn,
      });
    }
  } catch (err) {
    stderr.write(`[tocsify] error: ${err.message}\n`);
    return 1;
  }
  const writes = [[fileAbs, toc]];
  if (llms !== null) {
    writes.push([path.join(docsDir, 'llms.txt'), llms]);
    writes.push([path.join(docsDir, 'llms-full.txt'), full]);
  }
  const written = [];
  try {
    for (const [abs, data] of writes) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, data);
      written.push(abs);
    }
  } catch (err) {
    stderr.write(`[tocsify] error: ${err.message}\n`);
    return 1;
  }
  const names = writes.map(([abs]) => path.relative(cwd, abs).split(path.sep).join('/'));
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
