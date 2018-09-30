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
          return (
            !(
              str.indexOf('{docsify-ignore}') > 0
              && str.indexOf('{docsify-ignore-all}' > 0)
            )
            && (ele.level !== 1 || ele.slug !== fSlug)
          );
        },
        linkify(tok, text, slug) {
          const newToc = linkToc(tok, text, slug, {});
          newToc.content = newToc.content.replace('#', `${f}#`);
          return newToc;
        }
      });

      let retEntry = `### [${pp.name}](${f})\n${entry.content}\n`;
      if (entry.content.length > 0) retEntry += '\n';

      return retEntry;
    });

    const joinChar = out ? '' : '\n';
    const final = entries.join(joinChar);
    process.stdout.write(
      '[docsify-tocgen] SUCCESS: ToC built.\n---\n\n' + final
    );

    if (out) {
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
