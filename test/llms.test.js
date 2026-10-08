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
