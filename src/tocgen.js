const fs = require('fs');
const path = require('path');
const glob = require('glob');
const toc = require('markdown-toc');

const SKIP = {
  head: '{docsify-ignore}',
  all: '{docsify-ignore-all}',
  readme: 'README.md',
  index: 'index.md'
};

function generate(dir, flags) {
  glob(`${dir}/**/*.md`, (err, files) => {
    if (err) throw err;
    const joinChar = flags.file ? '' : '\n';

    const entries = files.map((f) => {
      if (f.match(SKIP.readme)) return;
      if (f.match(SKIP.index)) return;
      if (f.match(/_{1}.*[.md]/)) return;
      if (flags.file && f.match(flags.file)) return;

      const pp = path.parse(f);
      const fSlug = toc.slugify(pp.name);
      const linkToc = toc.linkify;
      const rDir = `${dir}/`;

      const entry = toc(fs.readFileSync(f, 'utf8'), {
        filter(s, e) {
          return (
            !(s.indexOf(SKIP.head) > -1 || s.indexOf(SKIP.all) > -1)
            && (e.level !== 1 || e.slug !== fSlug)
          );
        },
        linkify(tok, text, slug) {
          const newToc = linkToc(tok, text, slug, {});
          newToc.content = newToc.content
            .replace('#', `${f}#`)
            .replace(rDir, '');
          return newToc;
        }
      });

      let retEntry = `### [${f}](${f.replace(rDir, '')})\n${entry.content}\n`;
      if (entry.content.length > 0) retEntry += '\n';
      return retEntry.replace(rDir, '');
    });

    const final = entries.join(joinChar);
    if (flags.file) fs.writeFileSync(flags.file, final, 'utf8');
    if (flags.verbose) process.stdout.write(`\n${final}`);
  });
}

module.exports = generate;
