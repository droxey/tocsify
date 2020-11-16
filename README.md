# 📋 tocsify

[![NPM version](https://img.shields.io/npm/v/tocsify.svg?style=flat)](https://www.npmjs.com/package/tocsify) [![NPM downloads](https://img.shields.io/npm/dm/tocsify.svg?style=flat)](https://npmjs.org/package/tocsify) [![Build Status](https://img.shields.io/travis/droxey/tocsify.svg?style=flat)](https://travis-ci.org/droxey/tocsify)

📋 npm module that **generates a table of contents** based on the **file structure** of a [Docsify](https://docsify.js.org) `docs` directory!

## Features

* Adds relative path to title in each top-level entry for context.
* Skips markdown files beginning with `_`.
* Allows users to specify `maxdepth` for cleaner generation.
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
    --header, -h    Include a descriptive header. Default is true.
    --maxdepth, -m  Specify max level header(1 - 6) to output. Default is 3.

  Examples
    $ tocsify docs --file=docs/toc.md
    $ tocsify docs --verbose --file=docs/toc.md
    $ tocsify docs --maxdepth=2
    $ tocsify docs --header=false
```

## Integration

Integration with a [Docsify](https://docsify.js.org) homepage is easy!

In `index.md` or `_sidebar.md`, paste the snippet below where the Table of Contents should appear:

```markdown
## Table of Contents
[filename](toc.md ':include')
```

A working `index.md` file can be found in the docs directory [here](docs/index.md) for reference.
