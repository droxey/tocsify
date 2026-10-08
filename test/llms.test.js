'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { resolveBaseUrl, buildSite, renderLlmsTxt, renderLlmsFull } = require('../src/llms');

const root = path.join(__dirname, '..');
const siteDir = path.join(root, 'test/fixtures/site');

function makeDocs(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-llms-'));
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

function siteOf(docsDir, options = {}) {
  return buildSite({
    docsDir,
    baseUrl: 'https://example.com/docs/',
    exclude: [],
    cwd: docsDir,
    onWarn: options.onWarn,
    group: options.group,
    title: options.title,
    summary: options.summary,
  });
}

test('--base-url wins and gains a trailing slash', () => {
  const dir = makeDocs({});
  assert.equal(resolveBaseUrl({
    flag: 'https://example.com/docs', docsDir: dir, cwd: dir, env: {}, gitRemote: () => '',
  }), 'https://example.com/docs/');
  assert.equal(resolveBaseUrl({
    flag: 'https://example.com/docs/', docsDir: dir, cwd: dir, env: {}, gitRemote: () => '',
  }), 'https://example.com/docs/');
});

test('rejects a --base-url that is not http or https', () => {
  const dir = makeDocs({});
  assert.throws(() => resolveBaseUrl({
    flag: 'ftp://example.com', docsDir: dir, cwd: dir, env: {}, gitRemote: () => '',
  }), /--base-url must start with http:\/\/ or https:\/\//);
});

test('uses CNAME when there is no flag', () => {
  const dir = makeDocs({ CNAME: '\nexample.com\n' });
  assert.equal(resolveBaseUrl({
    docsDir: dir, cwd: dir, env: { GITHUB_REPOSITORY: 'other/repo' }, gitRemote: () => 'https://github.com/a/b.git',
  }), 'https://example.com/');
});

test('maps GITHUB_REPOSITORY to a project site URL', () => {
  const dir = makeDocs({});
  assert.equal(resolveBaseUrl({
    docsDir: dir, cwd: dir, env: { GITHUB_REPOSITORY: 'Owner/Repo' }, gitRemote: () => '',
  }), 'https://owner.github.io/Repo/');
});

test('maps GITHUB_REPOSITORY to a user site URL', () => {
  const dir = makeDocs({});
  assert.equal(resolveBaseUrl({
    docsDir: dir, cwd: dir, env: { GITHUB_REPOSITORY: 'Owner/Owner.github.io' }, gitRemote: () => '',
  }), 'https://owner.github.io/');
});

test('maps https, git@, and ssh GitHub remotes', () => {
  const dir = makeDocs({});
  const cases = [
    ['https://github.com/Owner/Repo.git', 'https://owner.github.io/Repo/'],
    ['git@github.com:Owner/Repo.git', 'https://owner.github.io/Repo/'],
    ['ssh://git@github.com/Owner/Repo.git', 'https://owner.github.io/Repo/'],
  ];
  for (const [remote, expected] of cases) {
    assert.equal(resolveBaseUrl({
      docsDir: dir, cwd: dir, env: {}, gitRemote: () => remote,
    }), expected);
  }
  const gitDir = makeDocs({});
  spawnSync('git', ['init'], { cwd: gitDir, encoding: 'utf8' });
  spawnSync('git', ['remote', 'add', 'origin', 'https://github.com/Owner/Live.git'], { cwd: gitDir, encoding: 'utf8' });
  assert.equal(resolveBaseUrl({
    docsDir: gitDir, cwd: gitDir, env: {},
  }), 'https://owner.github.io/Live/');
});

test('ignores a failed git command and a non-GitHub remote', () => {
  const dir = makeDocs({});
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-nogit-'));
  fs.writeFileSync(
    path.join(outside, 'package.json'),
    JSON.stringify({ homepage: 'https://from-pkg.example/docs/' }),
  );
  assert.equal(resolveBaseUrl({
    docsDir: dir, cwd: outside, env: {},
  }), 'https://from-pkg.example/docs/');
  const pkgDir = makeDocs({
    'package.json': JSON.stringify({ homepage: 'https://from-pkg.example/docs/' }),
  });
  assert.equal(resolveBaseUrl({
    docsDir: pkgDir, cwd: pkgDir, env: {}, gitRemote: () => 'https://gitlab.com/a/b.git',
  }), 'https://from-pkg.example/docs/');
});

test('uses package.json homepage without its hash or query', () => {
  const hashed = makeDocs({
    'package.json': JSON.stringify({ homepage: 'https://example.com/docs/#/index?x=1' }),
  });
  assert.equal(resolveBaseUrl({
    docsDir: hashed, cwd: hashed, env: {}, gitRemote: () => '',
  }), 'https://example.com/docs/');
  const bare = makeDocs({
    'package.json': JSON.stringify({ homepage: 'https://example.com/app' }),
  });
  assert.equal(resolveBaseUrl({
    docsDir: bare, cwd: bare, env: {}, gitRemote: () => '',
  }), 'https://example.com/app/');
});

test('follows the order CNAME, GITHUB_REPOSITORY, git remote, homepage', () => {
  const dir = makeDocs({
    CNAME: 'cname.example\n',
    'package.json': JSON.stringify({ homepage: 'https://home.example/' }),
  });
  assert.equal(resolveBaseUrl({
    docsDir: dir,
    cwd: dir,
    env: { GITHUB_REPOSITORY: 'Owner/Repo' },
    gitRemote: () => 'https://github.com/Other/Other.git',
  }), 'https://cname.example/');
});

test('throws an error that names --base-url when nothing is found', () => {
  const dir = makeDocs({ 'package.json': JSON.stringify({ homepage: 'ftp://example.com' }) });
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-none-'));
  assert.throws(() => resolveBaseUrl({
    docsDir: dir,
    cwd: outside,
    env: { GITHUB_REPOSITORY: 'noslash' },
  }), /--base-url/);
});

test('title and summary come from README.md', () => {
  const dir = makeDocs({
    'README.md': '# Toc Site\n\nThis is the home page. It explains the tool.\n',
  });
  const site = siteOf(dir);
  assert.equal(site.title, 'Toc Site');
  assert.equal(site.summary, 'This is the home page. It explains the tool.');
});

test('falls back to index.md when README.md is missing', () => {
  const dir = makeDocs({ 'index.md': '# Index Home\n\nIndex paragraph.\n' });
  const site = siteOf(dir);
  assert.equal(site.title, 'Index Home');
  assert.equal(site.groups[0].pages[0].rel, 'index.md');
});

test('--title and --summary override the home page', () => {
  const dir = makeDocs({ 'README.md': '# Home\n\nParagraph.\n' });
  const site = siteOf(dir, { title: 'Custom', summary: 'Short summary' });
  assert.equal(site.title, 'Custom');
  assert.equal(site.summary, 'Short summary');
});

test('summary skips a badge-only paragraph', () => {
  const dir = makeDocs({
    'README.md': '# Home\n\n[![npm](https://img.example/b.svg)](https://example.com)\n\nReal summary here.\n',
  });
  assert.equal(siteOf(dir).summary, 'Real summary here.');
});

test('title falls back to package.json name, then the folder name, and the blockquote is left out without a paragraph', () => {
  const named = makeDocs({ 'page.md': 'No heading and no paragraph marker.\n', 'package.json': JSON.stringify({ name: 'from-pkg' }) });
  const namedSite = siteOf(named);
  assert.equal(namedSite.title, 'from-pkg');
  assert.equal(namedSite.summary, '');
  assert.equal(renderLlmsTxt(namedSite).includes('> '), false);
  const folder = makeDocs({ 'package.json': '{}' });
  const folderSite = buildSite({
    docsDir: folder, baseUrl: 'https://example.com/', exclude: [], cwd: folder,
  });
  assert.equal(folderSite.title, path.basename(folder));
  assert.equal(folderSite.summary, '');
});

test('lists the home page first, then toc pages, without underscore, toc, or ignore-all pages', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-order-'));
  fs.cpSync(siteDir, dir, { recursive: true });
  const site = buildSite({
    docsDir: dir,
    baseUrl: 'https://example.com/docs/',
    exclude: [path.join(dir, 'toc.md'), path.join(dir, 'README.md')],
    cwd: dir,
  });
  const rels = site.groups.flatMap((group) => group.pages.map((page) => page.rel));
  assert.equal(rels.includes('README.md'), false);
  assert.equal(rels.includes('toc.md'), false);
  assert.equal(rels.includes('hidden.md'), false);
  assert.equal(rels.includes('_navbar.md'), false);
  assert.deepEqual(rels, [
    'about.md',
    'comments.md',
    'samples.md',
    'guide/parts/part.md',
    'guide/setup.md',
  ]);
  const withHome = buildSite({
    docsDir: dir,
    baseUrl: 'https://example.com/docs/',
    exclude: [path.join(dir, 'toc.md')],
    cwd: dir,
  });
  assert.equal(withHome.groups[0].pages[0].rel, 'README.md');
});

test('description comes from front matter', () => {
  const dir = makeDocs({
    'README.md': '# Home\n\nHome text.\n',
    'quoted.md': '---\ndescription: "Quoted text"\n---\n# Quoted\n',
    'single.md': "---\ndescription: 'Single text'\n---\n# Single\n",
    'plain.md': '---\ndescription: Plain text\n---\n# Plain\n',
  });
  const pages = siteOf(dir).groups.flatMap((group) => group.pages);
  const byRel = Object.fromEntries(pages.map((page) => [page.rel, page.description]));
  assert.equal(byRel['quoted.md'], 'Quoted text');
  assert.equal(byRel['single.md'], 'Single text');
  assert.equal(byRel['plain.md'], 'Plain text');
});

test('description falls back to the first sentence of the first paragraph', () => {
  const dir = makeDocs({
    'README.md': '# Home\n\nHome.\n',
    'story.md': '# Story\n\nFirst sentence. Second sentence.\n',
    'open.md': '# Open\n\nJust words\n',
  });
  const pages = siteOf(dir).groups.flatMap((group) => group.pages);
  const byRel = Object.fromEntries(pages.map((page) => [page.rel, page.description]));
  assert.equal(byRel['story.md'], 'First sentence.');
  assert.equal(byRel['open.md'], 'Just words');
});

test('an entry has no description when the page has no paragraph', () => {
  const dir = makeDocs({ 'README.md': '# Home\n', 'empty.md': '# Empty\n' });
  const page = siteOf(dir).groups[0].pages.find((item) => item.rel === 'empty.md');
  assert.equal(page.description, '');
  assert.equal(renderLlmsTxt(siteOf(dir)).includes('[Empty]'), true);
  assert.match(renderLlmsTxt(siteOf(dir)), /- \[Empty\]\(https:\/\/example.com\/docs\/empty\.md\)\n/);
});

test('entry title falls back to the path without .md', () => {
  const dir = makeDocs({ 'README.md': 'No h1 here.\n\nWords.\n', 'guide/no-h1.md': 'Body only.\n' });
  const pages = siteOf(dir).groups.flatMap((group) => group.pages);
  const guide = pages.find((page) => page.rel === 'guide/no-h1.md');
  assert.equal(guide.title, 'guide/no-h1');
});

test('URLs are absolute, use /, and percent-encode spaces', () => {
  const dir = makeDocs({ 'README.md': '# Home\n', 'my file.md': '# Space\n' });
  const page = siteOf(dir).groups[0].pages.find((item) => item.rel === 'my file.md');
  assert.equal(page.url, 'https://example.com/docs/my%20file.md');
  const bare = buildSite({
    docsDir: dir,
    baseUrl: 'https://example.com/docs',
    cwd: dir,
  });
  const again = bare.groups[0].pages.find((item) => item.rel === 'my file.md');
  assert.equal(again.url, 'https://example.com/docs/my%20file.md');
});

test('h2 grouping puts root pages under ## Docs and one H2 per folder in toc order', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-h2-'));
  fs.cpSync(siteDir, dir, { recursive: true });
  const site = buildSite({
    docsDir: dir,
    baseUrl: 'https://example.com/docs/',
    exclude: [path.join(dir, 'toc.md')],
    cwd: dir,
  });
  assert.deepEqual(site.groups.map((group) => group.name), ['Docs', 'guide/parts', 'guide']);
  const text = renderLlmsTxt(site);
  assert.match(text, /## Docs\n\n- \[Toc Site\]/);
  assert.match(text, /## guide\/parts\n\n- \[Part\]/);
  assert.match(text, /## guide\n\n- \[Setup\]/);
});

test('explicit --group=h2 equals the default', () => {
  const dir = makeDocs({ 'README.md': '# Home\n\nHi.\n', 'guide/a.md': '# A\n\nText.\n' });
  const one = siteOf(dir);
  const two = siteOf(dir, { group: 'h2' });
  assert.deepEqual(one.groups.map((group) => group.name), two.groups.map((group) => group.name));
});

test('sidebar grouping follows _sidebar.md sections and order', () => {
  const dir = makeDocs({
    'README.md': '# Home\n\nHi.\n',
    'about.md': '# About\n\nAbout text.\n',
    'guide/setup.md': '# Setup\n\nInstall.\n',
    'guide/deep.md': '# Deep\n\nNested.\n',
    'unlinked.md': '# Unlinked\n\nNot in the sidebar.\n',
    '_sidebar.md': [
      '- [Home](README.md)',
      '- [About](about.md)',
      '- Guide',
      '  - [Setup](guide/setup.md)',
      '    - [Deep](guide/deep.md)',
      '  - plain nested item',
    ].join('\n'),
  });
  const site = siteOf(dir, { group: 'sidebar' });
  assert.deepEqual(site.groups.map((group) => group.name), ['Docs', 'Guide']);
  assert.deepEqual(site.groups[0].pages.map((page) => page.rel), ['README.md', 'about.md']);
  assert.deepEqual(site.groups[1].pages.map((page) => page.rel), ['guide/setup.md', 'guide/deep.md']);
  assert.match(renderLlmsTxt(site), /## Guide\n\n- \[Setup\]\(https:\/\/example\.com\/docs\/guide\/setup\.md\): Install\.\n- \[Deep\]/);
});

test('sidebar links resolve /, folder/, and extensionless paths', () => {
  const dir = makeDocs({
    'README.md': '# Home\n\nHi.\n',
    'about.md': '# About\n\nAbout.\n',
    'guide/README.md': '# Guide home\n\nNested.\n',
    '_sidebar.md': [
      '- Docs',
      '  - [Root](/)',
      '  - [About](/about#intro)',
      '  - [Guide](guide/?tab=1)',
    ].join('\n'),
  });
  const site = siteOf(dir, { group: 'sidebar' });
  assert.deepEqual(site.groups[0].pages.map((page) => page.rel), [
    'README.md',
    'about.md',
    'guide/README.md',
  ]);
});

test('sidebar grouping skips external links', () => {
  const dir = makeDocs({
    'about.md': '# About\n\nAbout.\n',
    '_sidebar.md': '- Docs\n  - [About](about.md)\n  - [Out](https://example.com/x)\n  - [Mail](mailto:a@b.c)\n',
  });
  const site = siteOf(dir, { group: 'sidebar' });
  assert.deepEqual(site.groups.flatMap((group) => group.pages.map((page) => page.rel)), ['about.md']);
});

test('sidebar grouping warns on a missing page and skips it', () => {
  const dir = makeDocs({
    'about.md': '# About\n\nAbout.\n',
    '_sidebar.md': '- Docs\n  - [Missing](missing.md)\n  - [About](about.md)\n  - [Dir](guide)\n',
  });
  fs.mkdirSync(path.join(dir, 'guide'));
  const warnings = [];
  const site = siteOf(dir, { group: 'sidebar', onWarn: (message) => warnings.push(message) });
  assert.deepEqual(site.groups.flatMap((group) => group.pages.map((page) => page.rel)), ['about.md']);
  assert.deepEqual(warnings, ['sidebar link not found: missing.md', 'sidebar link not found: guide.md']);
});

test('sidebar grouping lists each page once, at its first link', () => {
  const dir = makeDocs({
    'about.md': '# About\n\nAbout.\n',
    'guide/setup.md': '# Setup\n\nInstall.\n',
    '_sidebar.md': [
      '- First',
      '  - [About](about.md)',
      '- Second',
      '  - [Again](/about)',
      '  - [Setup](guide/setup.md)',
      '  - [Setup again](guide/setup.md#install)',
    ].join('\n'),
  });
  const site = siteOf(dir, { group: 'sidebar' });
  assert.deepEqual(site.groups.map((group) => [group.name, group.pages.map((page) => page.rel)]), [
    ['First', ['about.md']],
    ['Second', ['guide/setup.md']],
  ]);
});

test('sidebar grouping skips underscore, dot, toc, and ignore-all pages and allows a folder README.md', () => {
  const dir = makeDocs({
    'about.md': '# About\n\nAbout.\n',
    'guide/README.md': '# Guide home\n\nNested.\n',
    'hidden.md': '# Hidden <!-- {docsify-ignore-all} -->\n',
    'toc.md': '# TOC\n',
    '_navbar.md': '- [About](about.md)\n',
    '_media/notes.md': '# Notes\n',
    '.secret.md': '# Secret\n',
    '_sidebar.md': [
      '- Docs',
      '  - [About](about.md)',
      '  - [Nav](_navbar.md)',
      '  - [Media](_media/notes.md)',
      '  - [Dot](.secret.md)',
      '  - [Hidden](hidden.md)',
      '  - [Toc](toc.md)',
      '  - [Guide](guide/README.md)',
    ].join('\n'),
  });
  const site = buildSite({
    docsDir: dir,
    baseUrl: 'https://example.com/docs/',
    exclude: [path.join(dir, 'toc.md')],
    group: 'sidebar',
    cwd: dir,
  });
  assert.deepEqual(site.groups.flatMap((group) => group.pages.map((page) => page.rel)), ['about.md', 'guide/README.md']);
});

test('sidebar grouping adds the home page when the sidebar does not link it', () => {
  const created = makeDocs({
    'README.md': '# Home\n\nHi.\n',
    'guide/setup.md': '# Setup\n\nInstall.\n',
    '_sidebar.md': '- Guide\n  - [Setup](guide/setup.md)\n',
  });
  const createdSite = siteOf(created, { group: 'sidebar' });
  assert.equal(createdSite.groups[0].name, 'Docs');
  assert.equal(createdSite.groups[0].pages[0].rel, 'README.md');
  const existing = makeDocs({
    'README.md': '# Home\n\nHi.\n',
    'about.md': '# About\n\nAbout.\n',
    '_sidebar.md': '- [About](about.md)\n- Later\n  - [About](about.md)\n',
  });
  const existingSite = siteOf(existing, { group: 'sidebar' });
  assert.equal(existingSite.groups[0].name, 'Docs');
  assert.deepEqual(existingSite.groups[0].pages.map((page) => page.rel), ['README.md', 'about.md']);
  const hidden = makeDocs({
    'README.md': '# Home <!-- {docsify-ignore-all} -->\n',
    'about.md': '# About\n\nAbout.\n',
    '_sidebar.md': '- [About](about.md)\n',
  });
  assert.deepEqual(siteOf(hidden, { group: 'sidebar' }).groups[0].pages.map((page) => page.rel), ['about.md']);
  const excludedSite = buildSite({
    docsDir: existing,
    baseUrl: 'https://example.com/docs/',
    exclude: [path.join(existing, 'README.md')],
    group: 'sidebar',
    cwd: existing,
  });
  assert.deepEqual(excludedSite.groups[0].pages.map((page) => page.rel), ['about.md']);
});

test('sidebar grouping without _sidebar.md throws', () => {
  const dir = makeDocs({ 'README.md': '# Home\n' });
  assert.throws(() => siteOf(dir, { group: 'sidebar' }), /sidebar file not found: _sidebar\.md/);
});

test('llms.txt ends with ## Optional linking llms-full.txt', () => {
  const dir = makeDocs({ 'README.md': '# Home\n\nHi.\n' });
  const text = renderLlmsTxt(siteOf(dir));
  assert.match(text, /## Optional\n\n- \[llms-full\.txt\]\(https:\/\/example\.com\/docs\/llms-full\.txt\): Full text of every page in one file\n$/);
});

test('llms.txt matches test/fixtures/site.llms.txt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-golden-'));
  fs.cpSync(siteDir, dir, { recursive: true });
  const site = buildSite({
    docsDir: dir,
    baseUrl: 'https://example.com/docs/',
    exclude: [path.join(dir, 'toc.md')],
    cwd: dir,
  });
  assert.equal(renderLlmsTxt(site), fs.readFileSync(path.join(root, 'test/fixtures/site.llms.txt'), 'utf8'));
});

test('llms-full.txt lists pages in llms.txt order with # Title and Source headers', () => {
  const dir = makeDocs({
    'README.md': '# Home\n\nHi.\n',
    'b.md': '# Bee\n\nSecond.\n',
  });
  const site = siteOf(dir);
  const full = renderLlmsFull(site);
  const titles = [...full.matchAll(/^# .+$/gm)].map((match) => match[0]);
  assert.deepEqual(titles, ['# Home', '# Bee']);
  assert.match(full, /Source: https:\/\/example.com\/docs\/README.md/);
  assert.ok(full.indexOf('# Home') < full.indexOf('# Bee'));
});

test('front matter and the first H1 are removed from each body', () => {
  const dir = makeDocs({
    'README.md': '---\ndescription: "D"\n---\n# Home\n\nKept.\n',
    'setext.md': 'Setext Title\n============\n\nBody stays.\n',
    'fenced.md': '```\n# Fake\n```\n> # Quoted\n# Real\n\nAfter.\n',
  });
  const full = renderLlmsFull(siteOf(dir));
  assert.equal(full.includes('description:'), false);
  assert.match(full, /# Home\nSource: .*\n\nKept\./);
  assert.match(full, /# Setext Title\nSource: .*\n\nBody stays\./);
  assert.match(full, /```\n# Fake\n```/);
  assert.match(full, /> # Quoted/);
  assert.match(full, /# Real\nSource:/);
  assert.match(full, /After\./);
});

test('both ignore-marker forms are stripped', () => {
  const dir = makeDocs({
    'README.md': '# Home {docsify-ignore}\n\nKeep <!-- {docsify-ignore-all} --> this.\n',
  });
  const full = renderLlmsFull(siteOf(dir));
  assert.equal(full.includes('docsify-ignore'), false);
  assert.match(full, /Keep this\./);
});

test('relative markdown links resolve from the docs root, as Docsify does', () => {
  const dir = makeDocs({
    'README.md': '# Home\n\nHi.\n',
    'guide/setup.md': '# Setup\n\n[other](other.md) [dot](./guide/next.md) [up](../top.md) [titled](other.md "Other page")\n',
  });
  const full = renderLlmsFull(siteOf(dir));
  assert.match(full, /\[other\]\(https:\/\/example\.com\/docs\/other\.md\)/);
  assert.match(full, /\[dot\]\(https:\/\/example\.com\/docs\/guide\/next\.md\)/);
  assert.match(full, /\[up\]\(https:\/\/example\.com\/top\.md\)/);
  assert.match(full, /\[titled\]\(https:\/\/example\.com\/docs\/other\.md "Other page"\)/);
});

test('absolute URLs, mailto links, #anchors, protocol-relative URLs, and code stay unchanged', () => {
  const dir = makeDocs({
    'README.md': [
      '# Home',
      '',
      '[ext](https://example.com/ext) [mail](mailto:a@b.c) [local](#local) [cdn](//cdn.example.com/x.js)',
      '',
      '![abs](https://example.com/pic.png) <img src="https://example.com/i.png">',
      '',
      '<a href="https://example.com/ext2">ext</a> <a href="mailto:a@b.c">mail</a>',
      '',
      '<a href="#local">local</a> <a href="//cdn.example.com/y.js">cdn</a>',
      '',
      '`[not a link](skip.md)`',
      '',
      '```',
      '[not](skip2.md)',
      '```',
    ].join('\n'),
  });
  const full = renderLlmsFull(siteOf(dir));
  assert.match(full, /\[ext\]\(https:\/\/example\.com\/ext\)/);
  assert.match(full, /\[mail\]\(mailto:a@b\.c\)/);
  assert.match(full, /\[local\]\(#local\)/);
  assert.match(full, /\[cdn\]\(\/\/cdn\.example\.com\/x\.js\)/);
  assert.match(full, /!\[abs\]\(https:\/\/example\.com\/pic\.png\)/);
  assert.match(full, /<img src="https:\/\/example\.com\/i\.png">/);
  assert.match(full, /<a href="https:\/\/example\.com\/ext2">/);
  assert.match(full, /<a href="mailto:a@b\.c">/);
  assert.match(full, /<a href="#local">/);
  assert.match(full, /<a href="\/\/cdn\.example\.com\/y\.js">/);
  assert.match(full, /`\[not a link\]\(skip\.md\)`/);
  assert.match(full, /```\n\[not\]\(skip2\.md\)\n```/);
});

test('extensionless and folder links load .md and README.md, as Docsify does', () => {
  const dir = makeDocs({
    'README.md': '# Home\n\nHi.\n',
    'guide/setup.md': '# Setup\n\n[ext](other) [dir](guide/) [hash](other#install) [query](?tab=1) [page](demo.html) [md](other.md?x=1)\n',
  });
  const full = renderLlmsFull(siteOf(dir));
  assert.match(full, /\[ext\]\(https:\/\/example\.com\/docs\/other\.md\)/);
  assert.match(full, /\[dir\]\(https:\/\/example\.com\/docs\/guide\/README\.md\)/);
  assert.match(full, /\[hash\]\(https:\/\/example\.com\/docs\/other\.md#install\)/);
  assert.match(full, /\[query\]\(https:\/\/example\.com\/docs\/README\.md\?tab=1\)/);
  assert.match(full, /\[page\]\(https:\/\/example\.com\/docs\/demo\.html\)/);
  assert.match(full, /\[md\]\(https:\/\/example\.com\/docs\/other\.md\?x=1\)/);
});

test('a relative link to a non-markdown file keeps its path from the docs root', () => {
  const dir = makeDocs({
    'README.md': '# Home\n\nHi.\n',
    'guide/setup.md': '# Setup\n\n[pdf](files/guide.pdf) [archive](files/demo.tar.gz)\n',
  });
  const full = renderLlmsFull(siteOf(dir));
  assert.match(full, /\[pdf\]\(https:\/\/example\.com\/docs\/files\/guide\.pdf\)/);
  assert.match(full, /\[archive\]\(https:\/\/example\.com\/docs\/files\/demo\.tar\.gz\)/);
});

test('markdown images resolve from the page folder, as Docsify does', () => {
  const dir = makeDocs({
    'README.md': '# Home\n\n![root](img/r.png)\n',
    'guide/setup.md': '# Setup\n\n![pic](./img/a.png) ![up](../img/b.png "B") [![badge](img/badge.svg)](other.md)\n',
  });
  const full = renderLlmsFull(siteOf(dir));
  assert.match(full, /!\[root\]\(https:\/\/example\.com\/docs\/img\/r\.png\)/);
  assert.match(full, /!\[pic\]\(https:\/\/example\.com\/docs\/guide\/img\/a\.png\)/);
  assert.match(full, /!\[up\]\(https:\/\/example\.com\/docs\/img\/b\.png "B"\)/);
  assert.match(full, /\[!\[badge\]\(https:\/\/example\.com\/docs\/guide\/img\/badge\.svg\)\]\(https:\/\/example\.com\/docs\/other\.md\)/);
});

test('img src resolves from the docs root, as the browser does in Docsify', () => {
  const dir = makeDocs({
    'README.md': '# Home\n\nHi.\n',
    'guide/setup.md': '# Setup\n\n<img src="img/b.png" alt="b"> <img alt=\'c\' src=\'./img/c.png\'>\n',
  });
  const full = renderLlmsFull(siteOf(dir));
  assert.match(full, /<img src="https:\/\/example\.com\/docs\/img\/b\.png" alt="b">/);
  assert.match(full, /<img alt='c' src='https:\/\/example\.com\/docs\/img\/c\.png'>/);
});
