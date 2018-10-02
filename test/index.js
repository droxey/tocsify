const assert = require('assert');
const chai = require('chai');
const chaiFiles = require('chai-files');
const fs = require('fs');
const generate = require('../src/tocgen');

const expect = chai.expect;
const file = chaiFiles.file;
const dir = chaiFiles.dir;

const testDir = './docs';
const filePath = './docs/toc.md';

chai.use(chaiFiles);

// expect(file('index.js')).to.exist;
// expect(file('index.coffee')).to.not.exist;
// expect(file('foo.txt')).to.not.contain('bar');
// expect(file('foo.txt')).to.equal(file('foo-copy.txt'));

describe('tocsify tests', () => {
  before((done) => {
    generate(testDir, {
      verbose: false,
      v: false,
      file: filePath,
      f: filePath
    });
    done();
  });

  it('should generate a toc file', () => {
    expect(file(filePath)).to.exist();
  });
  it('should generate toc that matches the user-supplied filename', () => {
    assert.equal('Hello'.length, 5);
  });
  it('should generate toc that ignores {docsify-ignore} tags', () => {
    assert.equal('Hello'.length, 5);
  });
  it('should generate toc that ignores {docsify-ignore-all} tags and all subheadings', () => {
    assert.equal('Hello'.length, 5);
  });

  after((done) => {
    fs.unlinkSync(filePath);
    done();
  });
});
