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
const { DoRequest } = require('./doRequest');
const { CliUx } = require('@oclif/core');
const { codes: internalCodes } = require('./internal-errors');
const { codes: validationCodes } = require('./validation-errors');

class CloudSdkAPIBase {
  /**
   * Initializes a CloudSdkAPIBase object and returns it.
   *
   * @param {string} cloudManagerUrl the cloudmanager api endpoint
   * @param {string} apiKey the cloudmanager api key
   * @param {string} orgId the cloudmanager org id
   * @param {string} accessToken The bearer token used to authenticate requests to the API.
   */
  constructor(cloudManagerUrl, apiKey, orgId, accessToken) {
    const authorizationHeaders = {
      Authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      body: 'blob',
    };
    this._cloudManagerClient = new DoRequest(
      cloudManagerUrl,
      Object.assign(
        {
          'x-api-key': apiKey,
          'x-gw-ims-org-id': orgId,
        },
        authorizationHeaders
      )
    );
  }

  async listProgramsIdAndName() {
    try {
      const response = await this._cloudManagerClient.doGet(`/programs`);

      if (response.status === 200) {
        const json = await response.json();
        const programs = json._embedded.programs;
        const slimPrograms = programs.map((program) => ({
          id: program.id,
          name: program.name,
        }));
        return slimPrograms;
      } else {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [response.status, response.statusText],
        });
      }
    } catch (err) {
      CliUx.ux.warn(`Failed to list programs: ${err.message}`);
      return null;
    }
  }

  async listEnvironmentsIdAndName(programId) {
    if (!programId) {
      throw new validationCodes.MISSING_PROGRAM_ID();
    }
    try {
      const apiUrl = `/program/${programId}/environments`;
      const response = await this._cloudManagerClient.doGet(apiUrl);

      if (response.status === 200) {
        const json = await response.json();
        const environments = json._embedded.environments;
        const slimEnvironments = environments.map((env) => ({
          id: env.id,
          name: env.name,
          type: env.type,
          status: env.status,
        }));
        return slimEnvironments;
      } else {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [response.status, response.statusText],
        });
      }
    } catch (err) {
      CliUx.ux.error(`Failed to list environments: ${err.message}`);
      throw err;
    }
  }
}

module.exports = {
  CloudSdkAPIBase,
};
