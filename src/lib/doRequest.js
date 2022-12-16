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
const { createFetch } = require('@adobe/aio-lib-core-networking');
const FormData = require('form-data');

const fetch = createFetch();

class DoRequest {
  /**
   * The base URL for the API endpoint
   *
   * @type {string}
   */
  _baseUrl;

  _accessToken;

  /**
   * Initializes a DoRequest object and returns it.
   *
   * @param {string} baseUrl the base URL to access the API
   */
  constructor(baseUrl, programId, environmentId, accessToken) {
    this._baseUrl = `${baseUrl}/program/${programId}/environment/${environmentId}`;
    this._accessToken = accessToken;
  }

  async doGet(path, body) {
    return this.doRequest('get', path, body);
  }

  async doPost(path, body) {
    return this.doRequest('post', path, body);
  }

  async doPut(path, body) {
    return this.doRequest('put', path, body);
  }

  async doDelete(path) {
    return this.doRequest('delete', path);
  }

  async doRequest(method, path, body) {
    const url = `${this._baseUrl}${path}`;
    const options = {
      method: method,
      headers: {
        Authorization: `Bearer ${this._accessToken}`,
        accept: 'application/json',
        body: 'blob',
      },
    };

    if (body instanceof FormData) {
      options.body = body;
    } else if (body) {
      options.body = JSON.stringify(body);
      options.headers['content-type'] = 'application/json';
    }

    return fetch(url, options);
  }
}

module.exports = {
  DoRequest: DoRequest,
};
