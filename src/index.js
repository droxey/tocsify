#!/usr/bin/env node

const meow = require('meow');
const generate = require('../src/tocgen');

const cli = meow(
  `
  Usage
    $ tocsify docs --file=docs/toc.md

  Options
    --verbose, -v   Write output to stdout.
    --file, -f      Write output to file.
    --header, -h    Include a descriptive header. Default is true.
    --maxdepth, -m  Specify max level header(1 - 6) to output. Default is 3.

  Examples
    $ tocsify docs --file=docs/toc.md
    $ tocsify docs --verbose --file=docs/toc.md
    $ tocsify docs --maxdepth=2
    $ tocsify docs --header=false
`, {
    flags: {
      verbose: {
        type: 'boolean',
        alias: 'v',
        default: false
      },
      header: {
        type: 'boolean',
        alias: 'h',
        default: true
      },
      file: {
        type: 'string',
        default: 'docs/toc.md',
        alias: 'f'
      },
      maxdepth: {
        type: 'Number',
        alias: 'm',
        default: 6
      },

    }
  }
);

generate(cli.input[0], cli.flags, () => {
  process.stdout.write('\n[tocsify] table of contents generated!\n');
  process.exit();
});
