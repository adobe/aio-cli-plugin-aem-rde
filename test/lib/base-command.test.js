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

const { CliUx } = require('@oclif/core');
const { BaseCommand, cli } = require('../../src/lib/base-command');
const { exitCodes } = require('../../src/lib/error-helpers');
const {
  codes: configurationCodes,
} = require('../../src/lib/configuration-errors');
const {
  codes: deploymentErrorCodes,
} = require('../../src/lib/deployment-errors');
const {
  codes: deploymentWarningCodes,
} = require('../../src/lib/deployment-warnings');
const { codes: internalCodes } = require('../../src/lib/internal-errors');
const { codes: validationCodes } = require('../../src/lib/validation-errors');
const assert = require('assert');
const sinon = require('sinon').createSandbox();
const { setupLogCapturing } = require('../util.js');
const proxyquire = require('proxyquire').noCallThru();
const jwt = require('jsonwebtoken');

describe('BaseCommand catch errors', function () {
  let errorSpy;
  let command;

  setupLogCapturing(sinon, cli);
  before(() => {
    sinon.useFakeTimers();
  });
  after(() => sinon.restore());

  beforeEach(() => {
    const errorFn = () => {};
    errorSpy = sinon.spy(errorFn);
    command = new BaseCommand(undefined, undefined, errorSpy);
  });
  afterEach(async () => {
    delete CliUx.ux.action.running;
  });

  it('Catch -- generic (no action running)', async function () {
    const err = new Error('msg');
    await command.catch(err);
    assert.equal(
      errorSpy.calledOnce,
      true,
      'Error function should be called once'
    );
    const errorFnExpectedArgs = [
      err.message,
      {
        code: err.code,
        exit: exitCodes.GENERAL,
      },
    ];
    assert(
      errorSpy.calledWith(...errorFnExpectedArgs),
      `Error function was called with arguments ${errorSpy.getCall(
        -1
      )} but it was expected ${JSON.stringify(errorFnExpectedArgs)}`
    );
  });

  it('Catch -- RDECLIConfigurationError', async function () {
    const err = new configurationCodes.TOKEN_IS_EXPIRED();
    await command.catch(err);
    assert.equal(
      errorSpy.calledOnce,
      true,
      'Error function should be called once'
    );
    const errorFnExpectedArgs = [
      err.message,
      {
        code: err.code,
        exit: exitCodes.CONFIGURATION,
      },
    ];
    assert(
      errorSpy.calledWith(...errorFnExpectedArgs),
      `Error function was called with arguments ${errorSpy.getCall(
        -1
      )} but it was expected ${JSON.stringify(errorFnExpectedArgs)}`
    );
  });

  it('Catch -- RDECLIDeploymentError', async function () {
    const err = new deploymentErrorCodes.INSTALL_FAILED();
    await command.catch(err);
    assert.equal(
      errorSpy.calledOnce,
      true,
      'Error function should be called once'
    );
    const errorFnExpectedArgs = [
      err.message,
      {
        code: err.code,
        exit: exitCodes.DEPLOYMENT_ERROR,
      },
    ];
    assert(
      errorSpy.calledWith(...errorFnExpectedArgs),
      `Error function was called with arguments ${errorSpy.getCall(
        -1
      )} but it was expected ${JSON.stringify(errorFnExpectedArgs)}`
    );
  });

  it('Catch -- RDECLIDeploymentWarning', async function () {
    const err = new deploymentWarningCodes.INSTALL_STAGED();
    await command.catch(err);
    assert.equal(
      errorSpy.calledOnce,
      true,
      'Error function should be called once'
    );
    const errorFnExpectedArgs = [
      err.message,
      {
        code: err.code,
        exit: exitCodes.DEPLOYMENT_WARNING,
      },
    ];
    assert(
      errorSpy.calledWith(...errorFnExpectedArgs),
      `Error function was called with arguments ${errorSpy.getCall(
        -1
      )} but it was expected ${JSON.stringify(errorFnExpectedArgs)}`
    );
  });

  it('Catch -- RDECLIInternalError', async function () {
    const err = new internalCodes.UNEXPECTED_API_ERROR({
      messageValues: [500, 'test'],
    });
    await command.catch(err);
    assert.equal(
      errorSpy.calledOnce,
      true,
      'Error function should be called once'
    );
    const errorFnExpectedArgs = [
      err.message,
      {
        code: err.code,
        exit: exitCodes.INTERNAL,
      },
    ];
    assert(
      errorSpy.calledWith(...errorFnExpectedArgs),
      `Error function was called with arguments ${errorSpy.getCall(
        -1
      )} but it was expected ${JSON.stringify(errorFnExpectedArgs)}`
    );
  });

  it('Catch -- RDECLIValidationError', async function () {
    const err = new validationCodes.MISSING_PROGRAM_ID();
    await command.catch(err);
    assert.equal(
      errorSpy.calledOnce,
      true,
      'Error function should be called once'
    );
    const errorFnExpectedArgs = [
      err.message,
      {
        code: err.code,
        exit: exitCodes.VALIDATION,
      },
    ];
    assert(
      errorSpy.calledWith(...errorFnExpectedArgs),
      `Error function was called with arguments ${errorSpy.getCall(
        -1
      )} but it was expected ${JSON.stringify(errorFnExpectedArgs)}`
    );
  });
});

describe('Authentication tests', function () {
  const accessToken = jwt.sign(
    {
      client_id: 'jwt_client_id',
    },
    'pKey',
    {}
  );
  const getOrganizationsStub = sinon.stub();
  const contextGetStub = sinon.stub();
  const contextGetCurrentStub = sinon.stub();
  const getTokenStub = sinon.stub();
  const getConfigStub = sinon.stub();
  const BaseCommandAuthMock = proxyquire('../../src/lib/base-command', {
    '@adobe/aio-lib-ims': {
      Ims: class Ims {
        getOrganizations() {
          return getOrganizationsStub();
        }
      },
      context: {
        get: contextGetStub,
        getCurrent: contextGetCurrentStub,
      },
      getToken: getTokenStub,
    },
    '@adobe/aio-lib-core-config': {
      get: getConfigStub,
      set: sinon.stub(),
    },
    '@adobe/aio-lib-cloudmanager': {
      init: () => ({
        getDeveloperConsoleUrl: () => 'http://example.com',
      }),
    },
  });
  beforeEach(function () {
    getOrganizationsStub.returns(
      Promise.resolve([
        {
          orgName: 'org1',
          orgRef: { ident: 'org1_id', authSrc: 'org1_auth_src' },
        },
        {
          orgName: 'org2',
          orgRef: { ident: 'org2_id', authSrc: 'org2_auth_src' },
        },
      ])
    );
    contextGetStub.callsFake((contextName) => {
      switch (contextName) {
        case 'my-context':
          return {
            data: {
              client_id: 'my-context-client_id',
            },
            local: true,
          };
        case 'cli':
          return {
            data: {},
          };
      }
    });
    contextGetCurrentStub.returns(undefined);
    getTokenStub.returns(accessToken);
  });
  afterEach(function () {
    getOrganizationsStub.reset();
    contextGetStub.reset();
    contextGetCurrentStub.reset();
    getTokenStub.reset();
    getConfigStub.reset();
  });
  it('should be able to fetch token and api key', async function () {
    contextGetCurrentStub.returns('my-context');
    const command = new BaseCommandAuthMock.BaseCommand();
    const result = await command.getTokenAndKey();
    assert.equal(result.accessToken, accessToken);
    assert.equal(result.apiKey, 'my-context-client_id');
    assert.equal(result.local, true);
  });
  it('should be able to fetch cli token and api key in case of api error', async function () {
    const command = new BaseCommandAuthMock.BaseCommand();
    const result = await command.getTokenAndKey();
    assert.equal(result.accessToken, accessToken);
    assert.equal(result.apiKey, 'jwt_client_id');
    assert.equal(result.local, false);
  });
  it('should throw cannot decode error', async function () {
    getTokenStub.returns(undefined);
    let err;
    try {
      const command = new BaseCommandAuthMock.BaseCommand();
      await command.getTokenAndKey();
    } catch (e) {
      err = e;
    }
    assert.equal(err.code, 'CLI_AUTH_CONTEXT_CANNOT_DECODE');
  });
  it('should throw no client id error', async function () {
    contextGetStub.returns({ data: {} });
    getTokenStub.returns(jwt.sign({}, 'pKey', {}));
    let err;
    try {
      const command = new BaseCommandAuthMock.BaseCommand();
      await command.getTokenAndKey();
    } catch (e) {
      err = e;
    }
    assert.equal(err.code, 'CLI_AUTH_CONTEXT_NO_CLIENT_ID');
  });
  it('throw error on calling runCommand method', function () {
    let err;
    try {
      const command = new BaseCommandAuthMock.BaseCommand();
      command.runCommand();
    } catch (e) {
      err = e;
    }
    assert.equal(
      err.message,
      'You have to implement the method runCommand(args, flags) in the subclass!'
    );
  });
  it('should return default base url', function () {
    const command = new BaseCommandAuthMock.BaseCommand();
    getConfigStub.returns(undefined);
    const baseUrl = command.getBaseUrl(false);
    assert.equal(baseUrl, 'https://cloudmanager.adobe.io');
  });
  it('should return stage base url', function () {
    const command = new BaseCommandAuthMock.BaseCommand();
    getConfigStub.returns(undefined);
    const baseUrl = command.getBaseUrl(true);
    assert.equal(baseUrl, 'https://cloudmanager-stage.adobe.io');
  });
  it('cloud sdk should be initialized properly', async function () {
    const command = new BaseCommandAuthMock.BaseCommand();
    const flags = {
      organizationId: 'orgId',
      programId: 'progId',
      environmentId: 'envId',
    };
    command.setupParams(flags);
    const callbackStub = sinon.stub();
    await command.withCloudSdk(callbackStub);
    assert.ok(callbackStub.calledOnce);
  });
});
