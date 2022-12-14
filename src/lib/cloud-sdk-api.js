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
const { handleRetryAfter, sleepSeconds } = require('./rde-utils');

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
   * @param {string} programId The ID of the program that contains the environment.
   * @param {string} environmentId The ID of the environment.
   * @param {string} accessToken The bearer token used to authenticate requests to the API.
   */
  constructor(baseUrl, programId, environmentId, accessToken) {
    this._baseUrl = `${baseUrl}/program/${programId}/environment/${environmentId}`;
    this._accessToken = accessToken;
  }

  async _doGet(path, body) {
    return await this._doRequest('get', path, body)
  }

  async _doPost(path, body) {
    return await this._doRequest('post', path, body)
  }

  async _doPut(path, body) {
    return await this._doRequest('put', path, body)
  }

  async _doDelete(path) {
    return await this._doRequest('delete', path)
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

    return await fetch(url, options);
  }

  async getLogs(id) {
    return await this._doGet(`/runtime/updates/${id}/logs`)
  }
  async getChanges() {
    return await this._doGet(`/runtime/updates`);
  }

  async getChange(id) {
    return await this._doGet(`/runtime/updates/${id}`);
  }

  async getArtifacts(cursor) {
    let queryString = cursor ? `?${new URLSearchParams({cursor}).toString()}` : '';
    return await this._doGet(`/runtime/updates/artifacts${queryString}`);
  }

  async deployFile(fileSize, path, name, type, target, contentPath, force, uploadCallbacks, deploymentCallback) {
    let result = await this._doPost(`/runtime/updates`, { service: target, fileSize: fileSize, type: type, metadata: { name: name }, contentPath: contentPath, force: force });

    if (result.status === 201) {
      let url = result.headers.get('Location');
      let changeId = (await result.json()).updateId;
      let client = new ShareFileClient(url);
      uploadCallbacks.start(fileSize)
      await client.uploadFile(path, {
        onProgress: (progress) => uploadCallbacks.progress(progress.loadedBytes)
      });
      return await this._putUpdate(changeId, deploymentCallback);
    } else {
      uploadCallbacks.abort()
      throw `Error: ${result.status} - ${result.statusText}`
    }
  }

  async deployURL(fileSize, url, name, type, target, contentPath, force, uploadCallbacks, deploymentCallback) {
    if (fileSize > 0) {
      uploadCallbacks.start(fileSize)
      let result = await this._doPost(`/runtime/updates`, { service: target, fileSize: fileSize, type: type, metadata: { name: name }, contentPath: contentPath, force: force });

      if (result.status === 201) {
        let clientUrl = result.headers.get('Location');
        let changeId = (await result.json()).updateId;
        let client = new ShareFileClient(clientUrl);
        let res = await client.startCopyFromURL(url);
        let copyId = res.copyId;

        let getProgressBytes = (copyProgress) => {
          return copyProgress ? parseInt(copyProgress.slice(0, copyProgress.indexOf('/'))) : 0
        }

        let progress = getProgressBytes(res.copyProgress)
        uploadCallbacks.progress(progress)
        let time = 0;
        while (res.copyId !== copyId || res.copyStatus === 'pending') {
          await sleepSeconds(1);
          if (time++ > 30 && progress === 0) {
            await client.abortCopyFromURL(copyId);
            uploadCallbacks.abort()
            break;
          }
          res = await client.getProperties();
          if (res.copyProgress) {
            progress = getProgressBytes(res.copyProgress);

            // URL deployments have quite large chunk sizes, so it can
            // be a while before the first chunk is uploaded. Let's indicate
            // that progress is happening, even though we haven't got the
            // numbers yet. Fake progress is limited to max 1/3 of the file
            // size.
            let fakeProgress = Math.round(time * fileSize / 60);
            uploadCallbacks.progress(Math.max(progress, fakeProgress));
          }
        }

        if (res.copyStatus !== 'success') {
          uploadCallbacks.start(fileSize, 'Direct URL transfer failed. Attempting download of the provided URL and upload of the file to RDE.')
          let con = await fetch(url);
          await client.uploadStream(con.body, fileSize, 1024 * 1024, 4, {
            onProgress: (progress) => uploadCallbacks.progress(progress.loadedBytes)
          });
        }
        return await this._putUpdate(changeId, deploymentCallback);
      } else {
        uploadCallbacks.abort()
        throw `Error: ${result.status} - ${result.statusText}`
      }
    } else {
      throw Error("Can not get file size from head request");
    }
  }

  async _putUpdate(changeId, callbackProgress) {
    let change = await handleRetryAfter(
        () => this._doPut(`/runtime/updates/${changeId}`),
        () => this._doGet(`/runtime/updates/${changeId}`),
        callbackProgress
    )
    if (change.status === 200) {
      return await change.json();
    } else {
      throw `Error: ${change.status} - ${change.statusText}`
    }
  }

  async delete(id, force) {
    let change = await handleRetryAfter(
        () => this._doDelete(`/runtime/updates/artifacts/${id}` + (force ? `?force=true` : '')),
        previousResponse => previousResponse.json()
            .then(json => this._doGet(`/runtime/updates/${json.updateId}`)))
    if (change.status === 200) {
      return await change.json();
    } else {
      throw `Error: ${change.status} - ${change.statusText}`
    }
  }
}

module.exports = {
  CloudSdkAPI: CloudSdkAPI,
}
