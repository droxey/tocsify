#!/usr/bin/env node

const meow = require('meow');
const generate = require('../src/tocgen');

const cli = meow(
  `
  Usage
    $ tocsify docs --output=docs/toc.md

  Options
    --verbose, -v   Write output to stdout.
    --file, -f      Write output to file.

  Examples
    $ tocsify docs --output=docs/toc.md
    $ tocsify docs --verbose --output=docs/toc.md
`,
  {
    flags: {
      verbose: {
        type: 'boolean',
        alias: 'v',
        default: false
      },
      file: {
        type: 'string',
        default: 'docs/toc.md',
        alias: 'f'
      }
    }
  }
);

generate(cli.input[0], cli.flags);
