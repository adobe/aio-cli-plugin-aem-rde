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
const { ShareFileClient } = require('@azure/storage-file-share');
const FormData = require('form-data');

const fetch = createFetch()

class CloudSdkAPI {
  /**
   * The base URL for the API endpoint
   *
   * @type {string}
   */
  _baseUrl;

  _accessToken;

  /**
   * Initializes a CloudSdkAPI object and returns it.
   *
   * @param {string} baseUrl the base URL to access the API
   */
  constructor(baseUrl, programId, environmentId, accessToken) {
    this._baseUrl = `${baseUrl}/program/${programId}/environment/${environmentId}`;
    this._accessToken = accessToken;
  }

  async _doGet(path, body) {
    return this._doRequest('get', path, body)
  }

  async _doPost(path, body) {
    return this._doRequest('post', path, body)
  }

  async _doPut(path, body) {
    return this._doRequest('put', path, body)
  }

  async _doDelete(path) {
    return this._doRequest('delete', path)
  }

  async _doRequest(method, path, body) {
    const url = `${this._baseUrl}${path}`
    const options = {
      method: method,
      headers: {
        Authorization: `Bearer ${this._accessToken}`,
        accept: 'application/json',
        body: 'blob'
      },
    }

    if (body instanceof FormData) {
      options.body = body
    } else if (body) {
      options.body = JSON.stringify(body)
      options.headers['content-type'] = 'application/json'
    }

    return fetch(url, options);
  }
  async getLogs(id) {
    return this._doGet(`/runtime/updates/${id}/logs`)
  }
  async getChanges() {
    return this._doGet(`/runtime/updates`);
  }

  async getChange(id) {
    return this._doGet(`/runtime/updates/${id}`);
  }

  async getStatus() {
    return this._doGet(`/runtime/updates/artifacts`);
  }

  async deployFile(fileSize, path, name, type, target, contentPath, force, callbackCopy, callbackProgress) {
    let result = await this._doPost(`/runtime/updates`, { service: target, fileSize: fileSize, type: type, metadata: { name: name }, contentPath: contentPath, force: force });

    if (result.status === 201) {
      let url = result.headers.get('Location');
      let changeId = (await result.json()).updateId;
      let client = new ShareFileClient(url);
      callbackCopy(`0/${fileSize}`);
      await client.uploadFile(path, {onProgress: (progress) => callbackCopy(`${progress.loadedBytes}/${fileSize}`)});

      let change = await this._doPut(`/runtime/updates/${changeId}`);

      while (change.status === 202) {
        callbackProgress();
        await this.delay(change.headers.get('Retry-After'));
        change = await this._doGet(`/runtime/updates/${changeId}`);
      }
      if (change.status === 200) {
        return await change.json();
      } else {
        throw `Error: ${change.status} - ${change.statusText}`
      }
    } else {
      throw `Error: ${result.status} - ${result.statusText}`
    }
  }

  async deployURL(fileSize, url, name, type, target, contentPath, force, callbackCopy, callbackProgress) {
    if (fileSize > 0) {
      let result = await this._doPost(`/runtime/updates`, { service: target, fileSize: fileSize, type: type, metadata: { name: name }, contentPath: contentPath, force: force });

      if (result.status === 201) {
        let clientUrl = result.headers.get('Location');
        let changeId = (await result.json()).updateId;
        let client = new ShareFileClient(clientUrl);
        let res = await client.startCopyFromURL(url);
        let copyId = res.copyId;

        let progress = res.copyProgress ? res.copyProgress : `0/${fileSize}`;
        callbackCopy(progress)
        let time = 0;
        while (res.copyId !== copyId || res.copyStatus === 'pending') {
          await this.delay(1000);
          if (time++ > 20 && progress === `0/${fileSize}`) {
            await client.abortCopyFromURL(copyId);
          }
          res = await new ShareFileClient(clientUrl).getProperties();
          if (res.copyProgress) {
            progress = res.copyProgress;
          }
          callbackCopy(progress);
        }

        if (res.copyStatus !== 'success') {
          let con = await fetch(url);
          await client.uploadStream(con.body, fileSize, 1024 * 1024, 4, {onProgress: (progress) => callbackCopy(`${progress.loadedBytes}/${fileSize}`)});
        }

        let change = await this._doPut(`/runtime/updates/${changeId}`);

        while (change.status === 202) {
          callbackProgress();
          await this.delay(change.headers.get('Retry-After'));
          change = await this._doGet(`/runtime/updates/${changeId}`);
        }
        if (change.status === 200) {
          return await change.json();
        } else {
          throw `Error: ${change.status} - ${change.statusText}`
        }
      } else {
        throw `Error: ${result.status} - ${result.statusText}`
      }
    } else {
      throw Error("Can not get file size from head request");
    }
  }

  async delete(id, force) {
    let change = await this._doDelete(`/runtime/updates/artifacts/${id}` + (force ? `?force=true` : ''));
    while (change.status === 202) {
      await this.delay();
      let changeId = (await change.json()).updateId;
      change = await this._doGet(`/runtime/updates/${changeId}`);
    }
    if (change.status === 200) {
      return await change.json();
    } else {
      throw `Error: ${change.status} - ${change.statusText}`
    }
  }

  delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }
}

module.exports = {
  CloudSdkAPI: CloudSdkAPI,
}
