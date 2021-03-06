const chai = require('chai');
const chaiFiles = require('chai-files');
const fs = require('fs');
const generate = require('../src/tocgen');

const expect = chai.expect;
const file = chaiFiles.file;

const testDir = './docs';
const fileName = 'toc-test.md';
const filePath = `${testDir}/${fileName}`;
const maxDepth = 3;
const header = false;

chai.use(chaiFiles);

describe('tocsify tests', () => {
  before((done) => {
    generate(
      testDir, {
        verbose: false,
        v: false,
        file: filePath,
        f: filePath,
        m: maxDepth,
        maxdepth: maxDepth,
        h: header,
        headers: header
      },
      () => {
        done();
      }
    );
  });

  it('should generate a toc file', () => {
    const watcher = fs.watch(testDir, (eventType, filename) => {
      if (filename === fileName) {
        expect(file(filePath)).to.exist();
        watcher.close();
      }
    });
  });

  it('should match the output of demo toc.md doc', () => {
    const watcher = fs.watch(testDir, (eventType, filename) => {
      if (filename === fileName) {
        expect(file(filePath)).to.equal(file('./docs/toc.md'));
        watcher.close();
      }
    });
  });
});
