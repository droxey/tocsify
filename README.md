# tocsify

[![NPM version](https://img.shields.io/npm/v/tocsify.svg?style=flat)](https://www.npmjs.com/package/tocsify) [![NPM downloads](https://img.shields.io/npm/dm/tocsify.svg?style=flat)](https://npmjs.org/package/tocsify)

tocsify reads a Docsify 5 `docs` folder and writes three files:

- `docs/toc.md`, a table of contents
- `docs/llms.txt`, an index for LLMs
- `docs/llms-full.txt`, the full text of every page

## Install

```bash
npm install -g tocsify
```

Node.js `>=22.13.0` is required.

## Usage

```text
Usage
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
```

`-h` means `--help`. It used to mean `--header`.

## Base URL

`llms.txt` and `llms-full.txt` use absolute links. tocsify picks the first hit:

1. `--base-url`, which must start with `http://` or `https://`
2. The first non-empty line of `<dir>/CNAME`
3. `GITHUB_REPOSITORY`, as `https://owner.github.io/repo/`
4. `git remote origin`, when it is a GitHub URL
5. `homepage` in `package.json`

Pass `--base-url` when the docs folder is not the GitHub Pages root. `--no-llm` skips this step and writes only `toc.md`.

In `llms-full.txt`, each relative link becomes the URL Docsify 5 loads with its default `relativePath: false`. Markdown links, `<img src>`, and `<a href>` resolve from the docs root. Markdown images resolve from the page folder. A link that starts with `/` resolves from the base URL, which is the docs root.

## GitHub Actions

Run tocsify on push to `main`, then commit the three files when they change. A push made with `GITHUB_TOKEN` does not start another workflow run.

```yaml
name: Docs
on:
  push:
    branches: [main]
permissions:
  contents: write
jobs:
  llms:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24.x
      - run: npx tocsify@3 docs
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add docs/toc.md docs/llms.txt docs/llms-full.txt
          git diff --cached --quiet || git commit -m "docs: update toc and llms files"
          git push
```

## Docsify 5

Put these two links in `<head>`:

```html
<link rel="alternate" type="text/markdown" href="llms.txt" title="llms.txt">
<link rel="alternate" type="text/markdown" href="llms-full.txt" title="llms-full.txt">
```

Put a `<noscript>` list in `<body>` that links `llms.txt`, `llms-full.txt`, and `toc.md`.

Load Docsify 5 from `dist/`. The `lib/` folder in the docsify 5 package still holds the 4.13.1 build.

```html
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@5/dist/themes/core.min.css">
<script src="//cdn.jsdelivr.net/npm/docsify@5/dist/docsify.min.js"></script>
```

This include still works in Docsify 5:

```markdown
[filename](toc.md ':include')
```

Links in `toc.md` use the `guide/setup.md#id` form. Docsify 5 rewrites them when `relativePath` is false, which is the default. With `relativePath: true`, a `toc.md` included from a subfolder page breaks these links.

## Skip rules

A markdown file is a page when all of these hold:

- The name ends in `.md`.
- No folder or file name starts with `_` or `.`.
- The base name is not exactly `README.md` or `index.md`.

`{docsify-ignore}` leaves that heading out of `toc.md`. `{docsify-ignore-all}` leaves the page out. The comment forms `<!-- {docsify-ignore} -->` and `<!-- {docsify-ignore-all} -->` count too.
