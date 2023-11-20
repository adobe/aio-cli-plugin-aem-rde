// /*
// Copyright 2023 Adobe. All rights reserved.
// This file is licensed to you under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may obtain a copy
// of the License at http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software distributed under
// the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
// OF ANY KIND, either express or implied. See the License for the specific language
// governing permissions and limitations under the License.
// */

const assert = require('assert');
const sinon = require('sinon').createSandbox();
const archiver = require('archiver');
const Zip = require('adm-zip');
const { dispatcherInputBuild } = require('../../src/lib/dispatcher.js'); 
const { cli } = require('../../src/lib/base-command');
const fs = require('fs');
const os = require('os');
const EventEmitter = require('node:events');
const path = require('path');

describe('Archive Utility', function () {
  let tmpDir;

  before(async function () {
    // Create temporary directories
    fs.mkdtemp(path.join(os.tmpdir(), 'aio-rde-dispatcher-test-'), (err, folder) => {
        if (err) throw err;
        tmpDir = folder;
    });
  });

  describe('#archiveDirectory', function () {
    it('should call archiver functions', async function () {
      const fsEmitter = new TestEmitter(); 
      const createWriteStreamStub = sinon.stub(fs, 'createWriteStream').returns(fsEmitter);
      const archiverStub = {
        pipe: sinon.stub(),
        finalize: sinon.stub().callsFake(() => {
            fsEmitter.emit('close');
            return Promise.resolve();
        }),
        pointer: sinon.stub().returns(1234),
        on: () => {},
      };
      const fsRealPathSyc = sinon.stub(fs, 'realpathSync').returns('new-zip-path');
      sinon.stub(archiver, 'create').withArgs('zip').returns(archiverStub);
      sinon.stub(cli, 'log');

      let {inputPath, inputPathSize} = await dispatcherInputBuild(cli, tmpDir);

      assert.equal(inputPath, 'new-zip-path');
      assert.equal(inputPathSize, 1234);
      assert.ok(createWriteStreamStub.calledOnce);
      assert.ok(archiverStub.pipe.calledOnce);
      assert.ok(archiverStub.finalize.calledOnce);
      assert.ok(archiverStub.pointer.calledOnce);

      createWriteStreamStub.restore();
      fsRealPathSyc.restore();
      archiver.create.restore();
      cli.log.restore();
    });

    it('should create output zip file', async function () {
        sinon.stub(cli, 'log');

        await fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'This is my text');

        let {inputPath, inputPathSize} = await dispatcherInputBuild(cli, tmpDir);
  
        assert.equal(inputPathSize, 145);
        assert.ok(await fs.existsSync(inputPath));
        const zip = new Zip(inputPath, {});
        assert.ok(zip.getEntry('test.txt') !== null);
  
        cli.log.restore();
    });
  });
});

class TestEmitter extends EventEmitter {}
