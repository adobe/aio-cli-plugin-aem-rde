/* eslint-disable node/no-unsupported-features/es-syntax */
const sinon = require('sinon');
const fs = require('fs');
const os = require('os');
const path = require('path');
const archiver = require('archiver');
const { frontendInputBuild } = require('../../src/lib/frontend');

describe('frontendInputBuild', function () {
  let sandbox;
  let basecommandMock;
  let expect;

  beforeEach(async function () {
    const chai = await import('chai');
    const chaiAsPromised = await import('chai-as-promised');
    chai.use(chaiAsPromised.default);
    expect = chai.expect;

    sandbox = sinon.createSandbox();
    basecommandMock = { doLog: sandbox.spy() };
    sandbox.stub(fs, 'existsSync');
    sandbox.stub(fs, 'mkdtemp');
    sandbox.stub(fs, 'createWriteStream');
    sandbox
      .stub(fs, 'realpathSync')
      .returns('real/path/to/frontend-pipeline.zip');
    sandbox.stub(os, 'tmpdir').returns('/tmp');
    sandbox.stub(path, 'join').callsFake((...args) => args.join('/'));
    sandbox.stub(archiver, 'create').returns({
      pointer: sandbox.stub().returns(1024),
      on: sandbox.stub(),
      pipe: sandbox.stub(),
      directory: sandbox.stub(),
      file: sandbox.stub(),
      finalize: sandbox.stub(),
    });
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('rejects when the "dist" folder is missing', async function () {
    fs.existsSync.withArgs('inputPath/dist').returns(false);
    fs.existsSync.withArgs('inputPath/package.json').returns(true);

    expect(frontendInputBuild(basecommandMock, 'inputPath')).to.be.rejectedWith(
      'There were some validation errors when processing zip file for the frontend-pipeline input path'
    );
    sinon.assert.calledWith(basecommandMock.doLog, sinon.match.string);
  });

  it('rejects when the "package.json" file is missing', async function () {
    fs.existsSync.withArgs('inputPath/dist').returns(true);
    fs.existsSync.withArgs('inputPath/package.json').returns(false);

    expect(frontendInputBuild(basecommandMock, 'inputPath')).to.be.rejectedWith(
      'There were some validation errors when processing zip file for the frontend-pipeline input path'
    );
    sinon.assert.calledWith(basecommandMock.doLog, sinon.match.string);
  });

  it('rejects on error during temporary directory creation', async function () {
    fs.existsSync.returns(true);
    fs.mkdtemp.callsFake((_, callback) => callback(new Error('mkdtemp error')));

    expect(frontendInputBuild(basecommandMock, 'inputPath')).to.be.rejectedWith(
      'mkdtemp error'
    );
  });

  it('rejects on error during zip operation', async function () {
    fs.existsSync.returns(true);
    fs.mkdtemp.callsFake((_, callback) => callback(null, '/tmp/aio-rde-'));
    const archiveMock = archiver.create();
    archiveMock.on.withArgs('error').yields(new Error('zip error'));

    expect(frontendInputBuild(basecommandMock, 'inputPath')).to.be.rejectedWith(
      'zip error'
    );
  });
});
