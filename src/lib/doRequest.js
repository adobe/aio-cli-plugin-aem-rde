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
 * Error codes that indicate the TLS handshake itself failed, rather than the
 * request being rejected by the server. In corporate environments these are
 * almost always caused by an HTTPS-inspecting proxy presenting a certificate
 * signed by an internal CA that Node.js does not trust: Node maintains its own
 * CA bundle and, unlike browsers, does not read the operating system trust
 * store.
 */
const TLS_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_SIGNATURE_FAILURE',
  'CERT_UNTRUSTED',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'EPROTO',
]);

/**
 * Extracts the most specific error code available from a failed fetch.
 *
 * Depending on the fetch implementation the underlying cause is either
 * attached as `cause` (undici/global fetch) or set directly on the error
 * (node-fetch), so both are inspected.
 *
 * @param {Error} error the error thrown by fetch
 * @returns {string} the error code, or 'UNKNOWN' when none is available
 */
function getErrorCode(error) {
  return error?.cause?.code || error?.code || 'UNKNOWN';
}

/**
 * Extracts the most descriptive message available from a failed fetch.
 *
 * Global fetch masks all transport failures as 'fetch failed' and puts the
 * real reason on `cause`, so the cause message is preferred when present.
 *
 * @param {Error} error the error thrown by fetch
 * @returns {string} the error message
 */
function getErrorMessage(error) {
  return error?.cause?.message || error?.message || String(error);
}

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
    if (!headers[REQUEST_ID_HEADER]) {
      // always ensure a request id is sent, even if the caller invoked
      // doRequest() directly without providing one
      headers[REQUEST_ID_HEADER] = requestId || crypto.randomUUID();
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

    try {
      return await fetch(url, options);
    } catch (error) {
      // fetch rejects (rather than returning a response) when the request
      // never completed: DNS failure, refused/reset connection, proxy issue
      // or a failed TLS handshake. Without this, such failures escape as an
      // opaque 'fetch failed' and get re-wrapped as an unexpected API error,
      // hiding the actual cause from the user.
      const code = getErrorCode(error);
      const errorDetails = [
        url,
        getErrorMessage(error),
        code,
        headers[REQUEST_ID_HEADER],
      ];
      if (TLS_ERROR_CODES.has(code)) {
        throw new internalCodes.TLS_ERROR({ messageValues: errorDetails });
      }
      throw new internalCodes.CONNECTION_ERROR({
        messageValues: errorDetails,
      });
    }
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
