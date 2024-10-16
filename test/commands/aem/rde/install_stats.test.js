const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const proxyquire = require('proxyquire');
const fetchMock = sinon.stub();
const DeployCommand = proxyquire(
  '../../../../src/commands/aem/rde/install.js',
  {
    '@adobe/aio-lib-core-networking': {
      createFetch: () => fetchMock,
    },
  }
);

describe('DeployCommand.computeStats', function () {
  let deployCommand;
  let fsRealpathSyncStub;
  let fsStatSyncStub;

  beforeEach(function () {
    deployCommand = new DeployCommand();
    fsRealpathSyncStub = sinon.stub(fs, 'realpathSync');
    fsStatSyncStub = sinon.stub(fs, 'statSync');
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should compute stats for an HTTP URL', async function () {
    const mockResponse = {
      url: 'http://example.com/test',
      headers: {
        get: (name) => {
          if (name === 'content-length') return 1234;
          return null;
        },
      },
    };
    fetchMock.returns(Promise.resolve(mockResponse));
    const url = new URL('http://example.com/test');

    const stats = await deployCommand.computeStats(url);

    assert.equal(stats.fileSize, 1234);
  });

  it('should compute stats for a file URL', async function () {
    const mockPath = '/local/path/test';
    const mockSize = 5678;
    fsRealpathSyncStub.returns(mockPath);
    fsStatSyncStub.returns({ size: mockSize });
    const url = new URL('file:///local/path/test');

    const stats = await deployCommand.computeStats(url);
    assert.equal(stats.fileSize, mockSize);
  });

  it('should throw an error for unsupported protocols', async function () {
    const url = new URL('ftp://example.com/test');

    try {
      await deployCommand.computeStats(url);
      expect.fail('Expected error was not thrown');
    } catch (err) {
      // ok
    }
  });
});
