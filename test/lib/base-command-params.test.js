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

const StatusCommand = require('../../src/commands/aem/rde/status.js');
const assert = require('assert');
const { createCloudSdkAPIStub } = require('../util');
const sinon = require('sinon').createSandbox();
const Config = require('@adobe/aio-lib-core-config');

const stubbedMethods = {
  getArtifacts: () =>
    Object.create({
      status: 200,
      json: () =>
        Object.create({
          status: 'Ready',
          items: [
            {
              id: 'test-bundle',
              updateId: '1',
              service: 'author',
              type: 'osgi-bundle',
              metadata: {
                name: 'test.all-1.0.0-SNAPSHOT.zip',
                bundleSymbolicName: 'test-bundle',
                bundleName: 'Test Bundle',
                bundleVersion: '1.0.0',
              },
            },
          ],
        }),
    }),
};

function createCommandStub(sinon, CommandClass, args, stubMethods) {
  return createCloudSdkAPIStub(sinon, new CommandClass(args, null), stubMethods);
}

let command, cloudSdkApiStub;

describe('ParamTestCommand take params', function () {
  beforeEach(() => {
    [command, cloudSdkApiStub] = createCommandStub(
      sinon,
      StatusCommand,
        [
          '--organizationId',
          'testOrg',
          '--programId',
          'testProg',
          '--environmentId',
          'testEnv',
        ],
      stubbedMethods
    );
  });

  it('should prioritize command line flags over .aio configuration values', async function () {
    await command.run();
    assert.equal(command._orgId, 'testOrg');
    assert.equal(command._programId, 'testProg');
    assert.equal(command._environmentId, 'testEnv');
  });
});

describe('ParamTestCommand use config values when flags are not provided, empty, or whitespace', function () {
  beforeEach(() => {
    sinon
        .stub(Config, 'get')
        .withArgs('cloudmanager_orgid')
        .returns('customOrg123')
        .withArgs('cloudmanager_programid')
        .returns('customProg123')
        .withArgs('cloudmanager_environmentid')
        .returns('customEnv123');
  });

  afterEach(() => {
    Config.get.restore();
  });

  const testCases = [
    { args: [], description: 'flags are not provided' },
    { args: ['--organizationId', '', '--programId', '', '--environmentId', ''], description: 'flags are empty' },
    { args: ['--organizationId', ' ', '--programId', ' ', '--environmentId', ' '], description: 'flags are whitespace' }
  ];

  testCases.forEach(({ args, description }) => {
    it('should use .aio configuration values when ${description}', async function () {
      [command, cloudSdkApiStub] = createCommandStub(
          sinon,
          StatusCommand,
          args,
          stubbedMethods
      );
      await command.run();
      assert.strictEqual(command._orgId, 'customOrg123');
      assert.strictEqual(command._programId, 'customProg123');
      assert.strictEqual(command._environmentId, 'customEnv123');
    });
  });
});
