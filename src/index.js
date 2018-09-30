#!/usr/bin/env node

const meow = require('meow');
const generate = require('../src/tocgen');

const cli = meow(
  `
  Usage
    $ tocsify docs

  Options
    --verbose, -v  Write output to stdout.
    --file, -f   Write output to file.

  Examples
    $ tocsify docs

    $ tocsify docs --output=docs/toc.md

    $ tocsify docs -v
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
        alias: 'f'
      }
    }
  }
);

generate(cli.input[0], cli.flags);
