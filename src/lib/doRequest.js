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
const { sleepSeconds } = require('./utils');

const fetch = createFetch();

class DoRequest {
  /**
   * Initializes a DoRequest object and returns it.
   *
   * @param {string} url the base URL to access the API
   * @param {object} headers headers to always send with this client
   */
  constructor(url, headers = {}) {
    this._baseUrl = url;
    this._headers = headers;
  }

  async doGet(path, body) {
    return await withRetries(
      async () => await this.doRequest('get', path, body),
      (response) => response && ((response.status >= 200 && response.status < 300) || response.status === 404),
      1,
      20
    );
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
      method,
      headers: this._headers,
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


/**
 * @param closure
 * @param successPredicate
 * @param retryIntervalSeconds
 * @param maxRetries
 */
async function withRetries(
  closure,
  successPredicate,
  retryIntervalSeconds,
  maxRetries
) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await closure();
    if (successPredicate(result)) {
      return result;
    }
    await sleepSeconds(retryIntervalSeconds);
  }
}

module.exports = {
  DoRequest,
  withRetries,
};
