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

const fetch = createFetch();

class CloudSdkAPI {
  /**
   * Initializes a CloudSdkAPI object and returns it.
   *
   * @param {string} cmUrl the cloudmanager api endpoint
   * @param {string} apiKey the cloudmanager api key
   * @param {string} orgId the cloudmanager org id
   * @param {string} devConsoleUrl the dev console url for the environment
   * @param {string} rdeApiUrl the base URL to access the API
   * @param {string} programId The ID of the program that contains the environment.
   * @param {string} environmentId The ID of the environment.
   * @param {string} accessToken The bearer token used to authenticate requests to the API.
   */
  constructor(
    cmUrl,
    apiKey,
    orgId,
    devConsoleUrl,
    rdeApiUrl,
    programId,
    environmentId,
    accessToken
  ) {
    this._cmUrl = cmUrl;
    this._apiKey = apiKey;
    this._orgId = orgId;
    this._devConsoleUrl = devConsoleUrl;
    this._programId = programId;
    this._environmentId = environmentId;
    this._rdeApiUrl = `${rdeApiUrl}/program/${programId}/environment/${environmentId}`;
    this._accessToken = accessToken;
  }

  async _doGet(path, body) {
    return await this._doRequest('get', path, body);
  }

  async _doPost(path, body) {
    return await this._doRequest('post', path, body);
  }

  async _doPut(path, body) {
    return await this._doRequest('put', path, body);
  }

  async _doDelete(path) {
    return await this._doRequest('delete', path);
  }

  async _doRequest(method, path, body) {
    const url = `${this._rdeApiUrl}${path}`;
    const options = {
      method,
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

    return await fetch(url, options);
  }

  async _doDevConsoleRequest(method, path, body) {
    const url = `${this._devConsoleUrl}${path}`;
    const options = {
      method,
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

    return await fetch(url, options);
  }

  async _doCMRequest(method, path, body) {
    const url = `${this._cmUrl}${path}`;
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${this._accessToken}`,
        accept: 'application/json',
        'x-api-key': this._apiKey,
        'x-gw-ims-org-id': this._orgId,
        body: 'blob',
      },
    };

    if (body instanceof FormData) {
      options.body = body;
    } else if (body) {
      options.body = JSON.stringify(body);
      options.headers['content-type'] = 'application/json';
    }

    return await fetch(url, options);
  }

  async _createError(response) {
    return `Error: ${response.status} - ${await response.text()}`;
  }

  async getLogs(id) {
    return await this._doGet(`/runtime/updates/${id}/logs`);
  }

  async getChanges() {
    return await this._doGet(`/runtime/updates`);
  }

  async getChange(id) {
    return await this._doGet(`/runtime/updates/${id}`);
  }

  async getArtifacts(cursor) {
    const queryString = cursor
      ? `?${new URLSearchParams({ cursor }).toString()}`
      : '';
    return await this._doGet(`/runtime/updates/artifacts${queryString}`);
  }

  async deployFile(
    fileSize,
    path,
    name,
    type,
    target,
    contentPath,
    force,
    uploadCallbacks,
    deploymentCallback
  ) {
    const result = await this._doPost(`/runtime/updates`, {
      service: target,
      fileSize,
      type,
      metadata: { name },
      contentPath,
      force,
    });

    if (result.status === 201) {
      const url = result.headers.get('Location');
      const changeId = (await result.json()).updateId;
      const client = new ShareFileClient(url);
      uploadCallbacks.start(fileSize);
      await client.uploadFile(path, {
        onProgress: (progress) =>
          uploadCallbacks.progress(progress.loadedBytes),
      });
      return await this._putUpdate(changeId, deploymentCallback);
    } else {
      uploadCallbacks.abort();
      throw await this._createError(result);
    }
  }

  async deployURL(
    fileSize,
    url,
    name,
    type,
    target,
    contentPath,
    force,
    uploadCallbacks,
    deploymentCallback
  ) {
    if (fileSize > 0) {
      uploadCallbacks.start(fileSize);
      const result = await this._doPost(`/runtime/updates`, {
        service: target,
        fileSize,
        type,
        metadata: { name },
        contentPath,
        force,
      });

      if (result.status === 201) {
        const clientUrl = result.headers.get('Location');
        const changeId = (await result.json()).updateId;
        const client = new ShareFileClient(clientUrl);
        let res = await client.startCopyFromURL(url);
        const copyId = res.copyId;

        const getProgressBytes = (copyProgress) => {
          return copyProgress
            ? parseInt(copyProgress.slice(0, copyProgress.indexOf('/')))
            : 0;
        };

        let progress = getProgressBytes(res.copyProgress);
        uploadCallbacks.progress(progress);
        let time = 0;
        while (res.copyId !== copyId || res.copyStatus === 'pending') {
          await sleepSeconds(1);
          if (time++ > 30 && progress === 0) {
            await client.abortCopyFromURL(copyId);
            uploadCallbacks.abort();
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
            const fakeProgress = Math.round((time * fileSize) / 60);
            uploadCallbacks.progress(Math.max(progress, fakeProgress));
          }
        }

        if (res.copyStatus !== 'success') {
          uploadCallbacks.start(
            fileSize,
            'Direct URL transfer failed. Attempting download of the provided URL and upload of the file to RDE.'
          );
          const con = await fetch(url);
          await client.uploadStream(con.body, fileSize, 1024 * 1024, 4, {
            onProgress: (progress) =>
              uploadCallbacks.progress(progress.loadedBytes),
          });
        }
        return await this._putUpdate(changeId, deploymentCallback);
      } else {
        uploadCallbacks.abort();
        throw await this._createError(result);
      }
    } else {
      throw Error('Can not get file size from head request');
    }
  }

  async _putUpdate(changeId, callbackProgress) {
    const change = await handleRetryAfter(
      () => this._doPut(`/runtime/updates/${changeId}`),
      () => this._doGet(`/runtime/updates/${changeId}`),
      callbackProgress
    );
    if (change.status === 200) {
      return await change.json();
    } else {
      throw await this._createError(change);
    }
  }

  async delete(id, force) {
    const change = await handleRetryAfter(
      () =>
        this._doDelete(
          `/runtime/updates/artifacts/${id}` + (force ? `?force=true` : '')
        ),
      (previousResponse) =>
        previousResponse
          .json()
          .then((json) => this._doGet(`/runtime/updates/${json.updateId}`))
    );
    if (change.status === 200) {
      return await change.json();
    } else {
      throw await this._createError(change);
    }
  }

  async _requestJson(callback) {
    const response = await callback();
    if (response.status === 200) {
      return await response.json();
    } else {
      throw await this._createError(response);
    }
  }

  async _waitForJson(predicate, request) {
    let json = await this._requestJson(request);

    while (!predicate(json)) {
      await sleepSeconds(10);
      json = await this._requestJson(request);
    }

    return json;
  }

  async _waitForEnvRunning(namespace) {
    await this._waitForEnv(namespace, 'running');
  }

  async _waitForEnvHibernated(namespace) {
    await this._waitForEnv(namespace, 'hibernated');
  }

  async _waitForEnvRunningOrHibernated(namespace) {
    return await this._waitForEnv(namespace, 'running', 'hibernated');
  }

  async _waitForEnv(namespace, state1, state2) {
    return (
      await this._waitForJson(
        (status) =>
          status.releases?.status[
            `cm-p${this._programId}-e${this._environmentId}`
          ]?.releaseState === state1 ||
          status.releases?.status[
            `cm-p${this._programId}-e${this._environmentId}`
          ]?.releaseState === state2,
        async () =>
          await this._doDevConsoleRequest(
            `get`,
            `/api/releases/${namespace}/status`
          )
      )
    ).releases.status[`cm-p${this._programId}-e${this._environmentId}`]
      .releaseState;
  }

  async _hibernateEnv(namespace) {
    await this._setEnvStatus(namespace, `hibernate`);
  }

  async _dehibernateEnv(namespace) {
    await this._setEnvStatus(namespace, `dehibernate`);
  }

  async _setEnvStatus(namespace, target) {
    await this._waitForJson(
      (status) => status.ok,
      async () =>
        await this._doDevConsoleRequest(
          `post`,
          `/api/releases/${namespace}/${target}/cm-p${this._programId}-e${this._environmentId}`
        )
    );
  }

  async _getNamespace() {
    const nameSpaceRequest = await this._doDevConsoleRequest(
      `get`,
      `/api/status`
    );
    if (nameSpaceRequest.status === 200) {
      const nameSpaceStatus = await nameSpaceRequest.json();
      if (
        nameSpaceStatus.availableNamespaces &&
        nameSpaceStatus.availableNamespaces[0]
      ) {
        return nameSpaceStatus.availableNamespaces[0];
      } else {
        throw new Error(`Error: no namespace found`);
      }
    } else {
      throw await this._createError(nameSpaceRequest);
    }
  }

  async _checkRDE() {
    const response = await this.getArtifacts(`limit=0`);
    if (response.status !== 200) {
      throw await this._createError(response);
    }
  }

  async _startEnv(namespace) {
    await this._dehibernateEnv(namespace);
    await this._waitForEnvRunning(namespace);
  }

  async _stopEnv(namespace) {
    await this._hibernateEnv(namespace);
    await this._waitForEnvHibernated(namespace);
  }

  async startEnv() {
    await this._checkRDE();
    const namespace = await this._getNamespace();
    const status = await this._waitForEnvRunningOrHibernated(namespace);
    if (status === 'hibernated') {
      await this._startEnv(namespace);
    } else {
      throw new Error(`Error: environment not hibernated`);
    }
  }

  async stopEnv() {
    await this._checkRDE();
    const namespace = await this._getNamespace();
    const status = await this._waitForEnvRunningOrHibernated(namespace);
    if (status === 'running') {
      await this._stopEnv(namespace);
    } else {
      throw new Error(`Error: environment not running`);
    }
  }

  async restartEnv() {
    await this._checkRDE();
    const namespace = await this._getNamespace();
    const status = await this._waitForEnvRunningOrHibernated(namespace);
    if (status === 'running') {
      await this._stopEnv(namespace);
    }
    await this._startEnv(namespace);
  }

  async resetEnv() {
    await this._checkRDE();
    await this._waitForEnvReady();
    await this._resetEnv();
    await this._waitForEnvReady();
  }

  async _resetEnv() {
    await this._doCMRequest(
      `put`,
      `/api/program/${this._programId}/environment/${this._environmentId}/reset`
    );
  }

  async _waitForEnvReady() {
    await this._waitForJson(
      (status) => status.status === 'ready',
      async () =>
        await this._doCMRequest(
          'get',
          `/api/program/${this._programId}/environment/${this._environmentId}`
        )
    );
  }
}

module.exports = {
  CloudSdkAPI,
};
