# Changelog

## 3.0.0

### Breaking

- Node `>=22.13.0`.
- `llms.txt` and `llms-full.txt` are written by default. `--no-llm` turns them off.
- A base URL is required unless tocsify can detect one.
- Anchors in `toc.md` now use Docsify 5 ids. This changes links for headings with leading digits, accents, emoji, `:id=`, links, or `#`.
- `-h` now means `--help` instead of `--header`.
- `bin` and `main` move to `src/cli.js`. `lib/` is gone. `exports` blocks deep imports.
- `dir` defaults to `docs`.

### Fixes

- The underscore skip rule.
- Exact `README.md` and `index.md` matching.
- Comment-form ignore markers.
- Help text that said `--maxdepth` defaults to 3.
- The demo loading Docsify 4.13.1.
- Tests that asserted nothing.

### Removed

- Every runtime dependency. This clears the markdown-toc and meow audit findings.
