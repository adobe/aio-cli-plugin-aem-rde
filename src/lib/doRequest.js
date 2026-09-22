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
const crypto = require('crypto');
const { createFetch } = require('@adobe/aio-lib-core-networking');
const FormData = require('form-data');
const { sleepSeconds } = require('./utils');
const { codes: internalCodes } = require('./internal-errors');
const fetch = createFetch();

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Reads a header from a fetch Response in a way that tolerates plain
 * objects (as used in tests) as well as the real Headers API.
 *
 * @param {object} response the fetch response (or response-like object)
 * @param {string} name the header name to read
 * @returns {string|undefined} the header value, if present
 */
function getResponseHeader(response, name) {
  const headers = response && response.headers;
  if (!headers) {
    return undefined;
  }
  if (typeof headers.get === 'function') {
    return headers.get(name) || undefined;
  }
  return headers[name];
}

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
    const requestId = crypto.randomUUID();
    const isDone = (response) =>
      response &&
      ((response.status >= 200 && response.status < 300) ||
        response.status === 404 ||
        response.status === 451); // 451 Unavailable For Legal Reasons, EAP early access),
    const ret = await withRetries(
      async () => await this.doRequest('get', path, body, requestId),
      isDone,
      1,
      5,
      true
    );
    if (isDone(ret)) {
      return ret;
    }
    if (ret) {
      // we did get a response back, it just wasn't one of the codes we
      // treat as a completed request (e.g. an auth failure or a 5xx),
      // so surface the real status instead of masking it as a NETWORK_ERROR
      throw new internalCodes.HTTP_ERROR({
        messageValues: [
          this._baseUrl + path,
          ret.status,
          ret.statusText,
          getResponseHeader(ret, REQUEST_ID_HEADER) || requestId,
        ],
      });
    }
    throw new internalCodes.NETWORK_ERROR({
      messageValues: [this._baseUrl + path, requestId],
    });
  }

  async doPost(path, body) {
    return this.do('post', path, body);
  }

  async doPut(path, body) {
    return this.do('put', path, body);
  }

  async doOptions(path, body) {
    return this.do('options', path, body);
  }

  async doPatch(path, body) {
    return this.do('patch', path, body);
  }

  async doDelete(path) {
    return this.do('delete', path);
  }

  async do(method, path, body) {
    const requestId = crypto.randomUUID();
    const ret = await this.doRequest(method, path, body, requestId);
    if (ret) {
      return ret;
    }
    throw new internalCodes.NETWORK_ERROR({
      messageValues: [this._baseUrl + path, requestId],
    });
  }

  async doRequest(method, path, body, requestId) {
    const url = `${this._baseUrl}${path}`;
    // clone the base headers so per-request additions (e.g. content-type,
    // x-request-id) don't leak into other requests made with this client
    const headers = { ...this._headers };
    if (requestId && !headers[REQUEST_ID_HEADER]) {
      headers[REQUEST_ID_HEADER] = requestId;
    }
    const options = {
      method,
      headers,
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
 * @param returnLastResultOnFailure when true, return the last result obtained
 *   from closure() even if it never satisfied successPredicate, instead of
 *   returning undefined. Defaults to false to preserve existing behavior for
 *   callers that rely on an undefined return to detect exhausted retries.
 */
async function withRetries(
  closure,
  successPredicate,
  retryIntervalSeconds,
  maxRetries,
  returnLastResultOnFailure = false
) {
  let result;
  for (let i = 0; i < maxRetries; i++) {
    result = await closure();
    if (successPredicate(result)) {
      return result;
    }
    if (i < maxRetries - 1) {
      await sleepSeconds(retryIntervalSeconds);
    }
  }
  return returnLastResultOnFailure ? result : undefined;
}

module.exports = {
  DoRequest,
  withRetries,
};
