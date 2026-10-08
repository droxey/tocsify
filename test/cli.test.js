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

test('--file and -f set the toc path', () => {
  const dir = makeDocs({ 'docs/guide.md': '# Guide\n\nHello.\n' });
  const result = runCli(['--no-llm', '--file', 'out/toc.md'], dir);
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'out/toc.md')), true);
  const short = runCli(['--no-llm', '-f', 'out/other.md'], dir);
  assert.equal(short.status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'out/other.md')), true);
});

test('--maxdepth and -m set the depth and reject 0, 7, and 2.5', () => {
  const dir = makeDocs({ 'docs/guide.md': '# Guide\n## Two\n### Three\n' });
  const result = runCli(['--no-llm', '--maxdepth=2'], dir);
  assert.equal(result.status, 0);
  const toc = fs.readFileSync(path.join(dir, 'docs/toc.md'), 'utf8');
  assert.equal(toc.includes('Three'), false);
  assert.equal(toc.includes('Two'), true);
  const short = runCli(['--no-llm', '-m', '1', '--file=docs/toc-m.md'], dir);
  assert.equal(short.status, 0);
  assert.equal(fs.readFileSync(path.join(dir, 'docs/toc-m.md'), 'utf8').includes('Two'), false);
  for (const value of ['0', '7', '2.5']) {
    const bad = runCli(['--no-llm', `--maxdepth=${value}`], dir);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /--maxdepth must be an integer from 1 to 6/);
  }
});

test('--no-header and --header=false drop ### and --header=true keeps it', () => {
  const dir = makeDocs({ 'docs/guide.md': '# Guide\n\nHello.\n' });
  const off = runCli(['--no-llm', '--no-header', '--file=off.md'], dir);
  assert.equal(off.status, 0);
  assert.equal(fs.readFileSync(path.join(dir, 'off.md'), 'utf8').includes('### '), false);
  const falseFlag = runCli(['--no-llm', '--header=false', '--file=false.md'], dir);
  assert.equal(falseFlag.status, 0);
  assert.equal(fs.readFileSync(path.join(dir, 'false.md'), 'utf8').includes('### '), false);
  const on = runCli(['--no-llm', '--header=true', '--file=on.md'], dir);
  assert.equal(on.status, 0);
  assert.match(fs.readFileSync(path.join(dir, 'on.md'), 'utf8'), /^### \[guide\]\(guide\.md\)/m);
});

test('--verbose and -v print the toc to stdout', () => {
  const dir = makeDocs({ 'docs/guide.md': '# Guide\n\nHello.\n' });
  const result = runCli(['--no-llm', '--verbose'], dir);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /\[guide\]\(guide\.md\)/);
  const short = runCli(['--no-llm', '-v', '--file=v.md'], dir);
  assert.equal(short.status, 0);
  assert.match(short.stdout, /\[guide\]\(guide\.md\)/);
});

test('an unknown flag exits 1', () => {
  const dir = makeDocs({});
  const result = runCli(['--bogus'], dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[tocsify\] error:/);
});

test('a missing docs folder exits 1', () => {
  const dir = makeDocs({});
  const missing = runCli(['missing', '--no-llm'], dir);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /docs folder not found: missing/);
  fs.writeFileSync(path.join(dir, 'not-a-dir'), 'x');
  const file = runCli(['not-a-dir', '--no-llm'], dir);
  assert.equal(file.status, 1);
  assert.match(file.stderr, /docs folder not found: not-a-dir/);
});

test('a missing base URL exits 1 and names --base-url', () => {
  const dir = makeDocs({ 'docs/guide.md': '# Guide\n' });
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tocsify-cli-none-'));
  fs.cpSync(path.join(dir, 'docs'), path.join(outside, 'docs'), { recursive: true });
  const result = runCli(['docs'], outside);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[tocsify\] error: could not detect the site URL/);
  assert.match(result.stderr, /--base-url/);
  assert.equal(fs.existsSync(path.join(outside, 'docs/toc.md')), false);
});

test('a bad --group value exits 1', () => {
  const dir = makeDocs({ 'docs/guide.md': '# Guide\n' });
  const result = runCli(['--group=nope', '--no-llm'], dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--group must be h2 or sidebar/);
});
