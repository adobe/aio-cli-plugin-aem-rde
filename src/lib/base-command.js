/*
 * Copyright 2022 Adobe Inc. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
const { Command, Flags, CliUx } = require('@oclif/core')
const { CloudSdkAPI } = require('../lib/cloud-sdk-api')
const { getToken, context } = require('@adobe/aio-lib-ims')
const Config = require('@adobe/aio-lib-core-config')
const { init } = require('@adobe/aio-lib-cloudmanager')
const jwt = require('jsonwebtoken')
const configurationCodes = require('../lib/errors')

function getCliOrgId() {
  return Config.get('cloudmanager_orgid') || Config.get('console.org.code');
}

function toJson(item) {
  let c = item
  if (typeof c === 'string') {
    c = JSON.parse(c)
  }

  return c
}

function getBaseUrl() {
  const configStr = Config.get('cloudmanager')
  return (configStr && toJson(configStr).base_url) || 'https://cloudmanager.adobe.io'
}

async function getTokenAndKey() {
  let accessToken;
  let apiKey;

  try {
    let contextName = 'aio-cli-plugin-cloudmanager';
    accessToken = await getToken(contextName);
    const contextData = await context.get(contextName)
    if (!contextData || !contextData.data) {
      throw new configurationCodes.NO_IMS_CONTEXT({ messageValues: contextName })
    }
    apiKey = contextData.data.client_id
  } catch (err) {
    accessToken = await getToken('cli');
    const decodedToken = jwt.decode(accessToken)
    if (!decodedToken) {
      throw new configurationCodes.CLI_AUTH_CONTEXT_CANNOT_DECODE()
    }
    apiKey = decodedToken.client_id
    if (!apiKey) {
      throw new configurationCodes.CLI_AUTH_CONTEXT_NO_CLIENT_ID()
    }
  }
  return {accessToken: accessToken, apiKey: apiKey};
}

async function initSdk() {
  const {accessToken, apiKey} = await getTokenAndKey();
  const orgId = getCliOrgId()
  const baseUrl = getBaseUrl()
  return await init(orgId, apiKey, accessToken, baseUrl)
}

class BaseCommand extends Command {

  _cloudSdkAPI;

  constructor(argv, config) {
    super(argv, config);
    let programId = Config.get('cloudmanager_programid');
    let environmentId = Config.get('cloudmanager_environmentid');
    this._programId = programId;
    this._environmentId = environmentId;
  }

  async getDeveloperConsoleUrl(programId, environmentId) {
    const sdk = await initSdk()
    return sdk.getDeveloperConsoleUrl(programId, environmentId);
  }

  async withCloudSdk(fn) {
    if (!this._cloudSdkAPI) {
      if (!this._programId) {
        throw "No programid"
      }
      if (!this._environmentId) {
        throw "No environmentId"
      }
      const {accessToken} = await getTokenAndKey();
      const cacheKey = `aem-rde.dev-console-url-cache.cm-p${this._programId}-e${this._environmentId}`;
      let cacheEntry = Config.get(cacheKey)
      // TODO: prune expired cache entries
      if (!cacheEntry || new Date(cacheEntry.expiry).valueOf() < Date.now()) {
        let developerConsoleUrl = await this.getDeveloperConsoleUrl(this._programId, this._environmentId);
        let url = new URL(developerConsoleUrl)
        url.hash = ''
        url.pathname = '/api/rde'
        let expiry = new Date()
        expiry.setDate(expiry.getDate() + 1) // cache for at most one day
        cacheEntry = {
          expiry: expiry.toISOString(),
          url: url.toString()
        }
        Config.set(cacheKey, cacheEntry)
      }
      this._cloudSdkAPI = new CloudSdkAPI(cacheEntry.url, this._programId, this._environmentId, accessToken)
    }
    return fn.call(null, this._cloudSdkAPI)
  }

  logChange(change) {
    CliUx.ux.log(`#${change.updateId}: ${change.action} ${change.status}` + (change.deletedArtifact ? ` for ${change.deletedArtifact.type} ${change.deletedArtifact.type === 'osgi-bundle' ? change.deletedArtifact.metadata.bundleSymbolicName : change.deletedArtifact.metadata.configPid}` :
      `${change.metadata && change.metadata.name ? ' for ' + change.type + ' ' + change.metadata.name : ''}`
    ) + (change.services ? ` on ${change.services}` : '') + ` - done by ${change.user} at ${change.timestamps.received}`)
  }
}

module.exports = {
  BaseCommand: BaseCommand,
  Flags: Flags,
  cli: CliUx.ux,
  commonArgs: {

  },
  commonFlags: {
    programId: Flags.string({ char: 'p', description: "the programId. If not specified, defaults to 'cloudmanager_programId' config value", common: true }),
    environmentId: Flags.string({ char: 'e', description: "the environmentId. If not specified, defaults to 'cloudmanager_environmentid' config value", common: true }),
    target: Flags.string({
      char: 's',
      description: "the target instance type; one of 'author' or 'publish'. If not specified, deployments target both 'author' and 'publish' instances.",
      multiple: false,
      required: false,
      options: [
        'author',
        'publish'
      ],
      common: true
    }),
  }
}
