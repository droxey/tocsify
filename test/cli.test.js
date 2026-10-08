'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { HELP } = require('../src/cli');

const root = path.join(__dirname, '..');
const cliPath = path.join(root, 'src/cli.js');

function makeDocs(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-cli-'));
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

function runCli(args, cwd, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.GITHUB_REPOSITORY;
  if (Object.prototype.hasOwnProperty.call(extraEnv, 'GITHUB_REPOSITORY')) {
    env.GITHUB_REPOSITORY = extraEnv.GITHUB_REPOSITORY;
  }
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    env,
    encoding: 'utf8',
  });
}

test('--help and -h print usage with maxdepth default 6', () => {
  const dir = makeDocs({});
  const long = runCli(['--help'], dir);
  const short = runCli(['-h'], dir);
  assert.equal(long.status, 0);
  assert.equal(short.status, 0);
  assert.equal(long.stdout, HELP);
  assert.equal(short.stdout, HELP);
  assert.match(HELP, /Default: 6/);
  assert.equal(fs.existsSync(path.join(dir, 'docs/toc.md')), false);
});

test('--version prints the package.json version', () => {
  const dir = makeDocs({});
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const result = runCli(['--version'], dir);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, `${pkg.version}\n`);
});

test('a default run writes toc.md, llms.txt, and llms-full.txt', () => {
  const dir = makeDocs({ 'docs/guide.md': '# Guide\n\nHello.\n', 'docs/README.md': '# Home\n\nWelcome.\n' });
  const result = runCli(['--base-url=https://example.com/docs/'], dir);
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'docs/toc.md')), true);
  assert.equal(fs.existsSync(path.join(dir, 'docs/llms.txt')), true);
  assert.equal(fs.existsSync(path.join(dir, 'docs/llms-full.txt')), true);
});

test('--no-llm writes only toc.md and needs no base URL', () => {
  const dir = makeDocs({ 'docs/guide.md': '# Guide\n\nHello.\n' });
  const result = runCli(['--no-llm'], dir);
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'docs/toc.md')), true);
  assert.equal(fs.existsSync(path.join(dir, 'docs/llms.txt')), false);
  assert.equal(fs.existsSync(path.join(dir, 'docs/llms-full.txt')), false);
});

test('dir defaults to docs and an extra positional fails', () => {
  const dir = makeDocs({ 'docs/guide.md': '# Guide\n\nHello.\n' });
  const ok = runCli(['--no-llm'], dir);
  assert.equal(ok.status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'docs/toc.md')), true);
  const bad = runCli(['docs', 'extra', '--no-llm'], dir);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /\[tocsify\] error: too many arguments/);
});
