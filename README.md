# 📋 tocsify

[![NPM version](https://img.shields.io/npm/v/tocsify.svg?style=flat)](https://www.npmjs.com/package/tocsify) [![NPM downloads](https://img.shields.io/npm/dm/tocsify.svg?style=flat)](https://npmjs.org/package/tocsify) [![Build Status](https://img.shields.io/travis/droxey/tocsify.svg?style=flat)](https://travis-ci.org/droxey/tocsify) [![Dependencies Status](https://david-dm.org/droxey/tocsify/status.svg?style=flat)](https://david-dm.org/droxey/tocsify) [![DevDependencies Status](https://david-dm.org/flexdidroxeynesh/tocsify/dev-status.svg?style=flat)](https://david-dm.org/droxey/tocsify?type=dev) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](https://opensource.org/licenses/MIT)

📋 npm module that **generates a table of contents** based on the **file structure** of a [Docsify](https://docsify.js.org) `docs` directory!

## Features

* Adds relative path to title in each top-level entry for context.
* Skips markdown files beginning with `_`.
* Allows users to specify `maxdepth` for cleaner Table of Content generation.
* Skips generation for headers marked `{docsify-ignore}`
* If `{docsify-ignore-all}` exists in a top level header (`# Example Header {docsify-ignore-all}`), skip generating the table of contents for the entire document.

## Installation

Install globally for use in any [Docsify](https://docsify.js.org) project!

```bash
npm install -g tocsify
```

## Usage

```bash
  Usage
    $ tocsify docs --file=docs/toc.md

  Options
    --verbose, -v   Write output to stdout.
    --file, -f      Write output to file.
    --maxdepth, -m  Specify max level header(1 - 6) to output.Default is 3.

  Examples
    $ tocsify docs --file=docs/toc.md
    $ tocsify docs --verbose --file=docs/toc.md
    $ tocsify docs --maxdepth=2
```

## Integration

Integration with a [Docsify](https://docsify.js.org) homepage is easy!

In `index.md` or `_sidebar.md`, paste the snippet below where the Table of Contents should appear:

```markdown
## Table of Contents
[filename](toc.md ':include')
```

A working `index.md` file can be found in the docs directory [here](docs/index.md) for reference.
