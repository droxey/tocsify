import { assert } from 'chai';

const fs = require('fs');
const generate = require('../src/tocgen');

const testDir = './fixtures/docs';
const tocFile = './fixtures/docs/table-of-contents.md';

describe('docsify-tocgen tests.', () => {
  before(() => {
    generate(testDir, tocFile);
  });

  after(() => {
    fs.unlinkSync(tocFile);
  });

  it('should generate output', () => {
    fs.stat(tocFile, (error) => {
      assert(!error);
    });
  });
});
