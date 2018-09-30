const fs = require('fs');
const path = require('path');
const glob = require('glob');
const toc = require('markdown-toc');

function generate(dir, out) {
  glob(`${dir}/**/*.md`, (err, files) => {
    if (err) throw err;

    const entries = files.map((f) => {
      if (f.match('index.md')) return;
      if (f.match('README.md')) return;
      if (f.match(/_{1}.*[.md]/)) return;
      if (f.match(out)) return;

      const pp = path.parse(f);
      const fSlug = toc.slugify(pp.name);
      const linkToc = toc.linkify;

      const entry = toc(fs.readFileSync(f, 'utf8'), {
        filter(str, ele) {
          const ignoreHeader = str.indexOf('{docsify-ignore}') > 0;
          return ele.level !== 1 || ele.slug !== fSlug || ignoreHeader;
        },
        linkify(tok, text, slug) {
          const newToc = linkToc(tok, text, slug, {});
          newToc.content = newToc.content.replace('#', `${f}#`);
          return newToc;
        }
      });

      return `### [${pp.name}](${f})\n${entry.content}\n\n`;
    });

    const joinChar = out ? '' : '\n';
    const final = entries.join(joinChar);
    process.stdout.write(final);

    if (out) {
      // Write the file to the path specified.
      fs.writeFile(
        out,
        final,
        'utf8',
        wErr => (wErr ? console.error(wErr) : null)
      );
    }
  });
}

module.exports = generate;
