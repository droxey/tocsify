const fs = require('fs');
const path = require('path');
const glob = require('glob');
const toc = require('markdown-toc');

const SKIP_FILES = ['index.md', 'README.md', 'node_modules'];
const SKIP_HEADERS = ['{docsify-ignore}', '{docsify-ignore-all}'];

module.exports = (dir, out) => {
  glob(`${dir}/**/*.md`, (err, files) => {
    if (err) throw err;

    const entries = files.map((f) => {
      // Skip processing for files we know don't need to be in the Table of Contents.
      // Always skip Docsify's configuration files, which begin with `_`.
      if (f.startsWith('_') || SKIP_FILES.some(p => f.includes(p))) return;

      const pp = path.parse(f);
      const fSlug = toc.slugify(pp.name);
      const linkToc = toc.linkify;
      const idxParentDir = pp.dir.indexOf(`/${dir}`) + dir.length + 1;

      console.log(idxParentDir);

      const entry = toc(fs.readFileSync(f, 'utf8'), {
        // [filter] Skip top-level elements if...
        //  - They aren't # level headers.
        //  - Their slug matches a slug of the filename.
        //  - The heading text contains a string in the SKIP_HEADERS array.
        filter: (str, ele) => ele.level !== 1
          || ele.slug !== fSlug
          || SKIP_HEADERS.some(h => str.includes(h)),
        // [linkify] Prepend filename to links. Use empty options arg to avoid infinite recursion.
        linkify: (tok, text, slug) => {
          const newToc = linkToc(tok, text, slug, {});
          newToc.content = newToc.content.replace('#', `${f}#`);
          return newToc;
        }
      });

      // Return the filename as a heading.
      return `### [${pp.name}](${f})\n${entry.content}\n`;
    });

    const joinChar = out ? '' : '\n';
    const final = entries.join(joinChar);

    if (out) {
      // Write the file to the path specified.
      fs.writeFile(
        out,
        final,
        'utf8',
        wErr => (wErr ? console.error(wErr) : null)
      );
    }

    return final;
  });
};
