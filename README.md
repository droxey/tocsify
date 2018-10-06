# 📋 tocsify

[![NPM version](https://img.shields.io/npm/v/tocsify.svg?style=flat)](https://www.npmjs.com/package/tocsify) [![NPM downloads](https://img.shields.io/npm/dm/tocsify.svg?style=flat)](https://npmjs.org/package/tocsify) [![Build Status](https://img.shields.io/travis/droxey/tocsify.svg?style=flat)](https://travis-ci.org/droxey/tocsify) [![Dependencies Status](https://david-dm.org/droxey/tocsify/status.svg?style=flat)](https://david-dm.org/droxey/tocsify) [![DevDependencies Status](https://david-dm.org/flexdidroxeynesh/tocsify/dev-status.svg?style=flat)](https://david-dm.org/droxey/tocsify?type=dev) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](https://opensource.org/licenses/MIT)

📋 npm module that **generates a table of contents** based on the **file structure** of a [Docsify](https://docsify.js.org) `docs` directory!

## Features

* Skips markdown files beginning with `_`.
* Skips generation for headers marked `{docsify-ignore}` and `{docsify-ignore-all}`.
* Adds relative path to title in each top-level entry for context.

## Installation

Install globally for use in any [Docsify](https://docsify.js.org) project!

```bash
npm install -g tocsify
```

## Usage

### Save to File

From the root of your project, simply run:

```bash
tocsify docs --file=docs/toc.md
```

### Save File with Verbose Output

For verbose output that also saves to a file, run:

```bash
tocsify docs --file=docs/toc.md --verbose
```

### Write to Console

To just write to `stdout` -- without saving a file -- run:

```bash
tocsify docs --verbose
```

## Integration

Integration with a [Docsify](https://docsify.js.org) homepage is easy!

In `index.md`, paste the snippet below where the Table of Contents should appear:

```markdown
## Table of Contents
[filename](toc.md ':include')
```

A working `index.md` file can be found in the docs directory [here](docs/index.md) for reference.
