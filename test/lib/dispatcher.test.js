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
const proxyquire = require('proxyquire').noCallThru();

class TestEmitter extends EventEmitter {}

const emmiter = new TestEmitter();
const dispatcher = proxyquire('../../src/lib/dispatcher.js', {
  fs: {
    mkdtemp: function (path, callback) {
      callback(new Error('failed to mkdtemp'));
    },
    lstatSync: function (path) {
      return () => ({
        isDirectory: () => true,
      });
    },
  },
});
const isDirStub = sinon.stub();
isDirStub.onFirstCall().returns(true);
isDirStub.returns(false);
const emptyStub = sinon.stub();
const stringFnStub = sinon.stub();
const wsEmiter = new TestEmitter();
const archDispatcher = proxyquire('../../src/lib/dispatcher.js', {
  fs: {
    mkdtemp: (path, callback) => {
      callback(undefined, '');
    },
    createWriteStream: () => wsEmiter,
    lstatSync: function (path) {
      return {
        isDirectory: isDirStub,
        isSymbolicLink: () => true,
      };
    },
    readdirSync: () => ['example'],
    readlinkSync: stringFnStub,
    realpathSync: stringFnStub,
  },
  archiver: function () {
    emmiter.file = emptyStub;
    emmiter.pipe = emptyStub;
    emmiter.symlink = emptyStub;
    emmiter.finalize = () =>
      Promise.resolve().then(() => wsEmiter.emit('close'));
    emmiter.pointer = emptyStub;
    return emmiter;
  },
});

describe('Archive Utility', function () {
  let tmpDir;

  beforeEach(async function () {
    // Create temporary directories
    tmpDir = await fs.mkdtempSync(
      path.join(os.tmpdir(), 'aio-rde-dispatcher-test-')
    );
  });

  describe('#archiveDirectory', function () {
    it('should call archiver functions', async function () {
      const fsEmitter = new TestEmitter();
      const createWriteStreamStub = sinon
        .stub(fs, 'createWriteStream')
        .returns(fsEmitter);
      const archiverStub = {
        pipe: sinon.stub(),
        finalize: sinon.stub().callsFake(() => {
          fsEmitter.emit('close');
          return Promise.resolve();
        }),
        pointer: sinon.stub().returns(1234),
        on: () => {},
      };
      const fsRealPathSyc = sinon
        .stub(fs, 'realpathSync')
        .returns('new-zip-path');
      sinon.stub(archiver, 'create').withArgs('zip').returns(archiverStub);

      const { inputPath, inputPathSize } = await dispatcherInputBuild(
        cli,
        tmpDir
      );

      assert.equal(inputPath, 'new-zip-path');
      assert.equal(inputPathSize, 1234);
      assert.ok(createWriteStreamStub.calledOnce);
      assert.ok(archiverStub.pipe.calledOnce);
      assert.ok(archiverStub.finalize.calledOnce);
      assert.ok(archiverStub.pointer.calledOnce);

      createWriteStreamStub.restore();
      fsRealPathSyc.restore();
      archiver.create.restore();
    });

    it('should create output zip file', async function () {
      sinon.stub(cli, 'log');

      await fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'This is my text');

      const { inputPath, inputPathSize } = await dispatcherInputBuild(
        cli,
        tmpDir
      );

      assert(
        inputPathSize > 140 && inputPathSize < 150,
        'zipped size: expected 140..150 bytes'
      );
      assert.ok(await fs.existsSync(inputPath));
      const zip = new Zip(inputPath, {});
      assert.ok(zip.getEntry('test.txt') !== null);
    });
    it('should reject on emitted error', async function () {
      let err;
      try {
        emmiter.emit('error', new Error('failed'));
        await dispatcher.dispatcherInputBuild({}, '');
      } catch (e) {
        err = e;
      }
      assert.equal(err?.message, 'failed');
    });
    it('should add directory to archive', async function () {
      //
      let err;
      try {
        await archDispatcher.dispatcherInputBuild({ log: () => {} }, '');
      } catch (e) {
        err = e;
      }
      assert.equal(err, undefined);
    });
  });
  describe('#dispatcherInputBuild', function () {
    it('should reject', async function () {
      let err;
      try {
        await dispatcher.dispatcherInputBuild({}, '');
      } catch (e) {
        err = e;
      }
      assert.equal(err.message, 'failed to mkdtemp');
    });
  });
});
