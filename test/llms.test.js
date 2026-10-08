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
