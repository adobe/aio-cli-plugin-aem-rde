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
const { DoRequest } = require("./doRequest");

const fetch = createFetch();

class CloudSdkAPI {
  /**
   * Initializes a CloudSdkAPI object and returns it.
   *
   * @param {string} cloudManagerUrl the cloudmanager api endpoint
   * @param {string} devConsoleUrl the dev console url for the environment
   * @param {object} rdeUrl the RDE API endpoint for the environment
   * @param {string} apiKey the cloudmanager api key
   * @param {string} orgId the cloudmanager org id
   * @param {string} programId The ID of the program that contains the environment.
   * @param {string} environmentId The ID of the environment.
   * @param {string} accessToken The bearer token used to authenticate requests to the API.
   */
  constructor(
    cloudManagerUrl,
    devConsoleUrl,
    rdeUrl,
    apiKey,
    orgId,
    programId,
    environmentId,
    accessToken
  ) {
    let authorizationHeaders = {
      Authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      body: 'blob',
    };
    this._cloudManagerClient = new DoRequest(cloudManagerUrl, Object.assign({
      'x-api-key': apiKey,
      'x-gw-ims-org-id': orgId,
    }, authorizationHeaders));
    this._devConsoleClient = new DoRequest(devConsoleUrl, authorizationHeaders);
    this._rdeClient = new DoRequest(rdeUrl, authorizationHeaders);
    this._cmReleaseId = `cm-p${programId}-e${environmentId}`
  }

  async getAemLogs(serviceName) {
    return await this._rdeClient.doGet(`/runtime/${serviceName}/logs`);
  }

  async getAemLog(serviceName, id) {
    return await this._rdeClient.doGet(`/runtime/${serviceName}/logs/${id}`);
  }

  async getAemLogTail(serviceName, id) {
    return await this._rdeClient.doGet(`/runtime/${serviceName}/logs/${id}/tail`);
  }

  async createAemLog(serviceName, data) {
    return await this._rdeClient.doPost(`/runtime/${serviceName}/logs`, data);
  }

  async deleteAemLog(serviceName, id) {
    return await this._rdeClient.doDelete(`/runtime/${serviceName}/logs/${id}`);
  }

  async getRequestLogs(serviceName) {
    return await this._rdeClient.doGet(`/runtime/${serviceName}/request-logs`);
  }

  async getRequestLog(serviceName, id) {
    return await this._rdeClient.doGet(`/runtime/${serviceName}/request-logs/${id}`);
  }

  async enableRequestLogs(serviceName, data) {
    return await this._rdeClient.doPost(`/runtime/${serviceName}/request-logs`, data);
  }

  async disableRequestLogs(serviceName) {
    return await this._rdeClient.doDelete(`/runtime/${serviceName}/request-logs`);
  }

  async getInventories(serviceName) {
    return await this._rdeClient.doGet(`/runtime/${serviceName}/status/inventory`);
  }

  async getInventory(serviceName, id) {
    return await this._rdeClient.doGet(
        `/runtime/${serviceName}/status/inventory/${id}`
    );
  }

  async getOsgiBundles(serviceName) {
    return await this._rdeClient.doGet(`/runtime/${serviceName}/status/osgi-bundles`);
  }

  async getOsgiBundle(serviceName, id) {
    return await this._rdeClient.doGet(
        `/runtime/${serviceName}/status/osgi-bundles/${id}`
    );
  }

  async getOsgiComponents(serviceName) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/status/osgi-components`
    );
  }

  async getOsgiComponent(serviceName, componentName) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/status/osgi-components/${componentName}`
    );
  }

  async getOsgiConfigurations(serviceName) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/status/osgi-configurations`
    );
  }

  async getOsgiConfiguration(serviceName, pId) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/status/osgi-configurations/${pId}`
    );
  }

  async getOsgiService(serviceName) {
    return await this._rdeClient.doGet(`/runtime/${serviceName}/status/osgi-services`);
  }

  async getOsgiService(serviceName, id) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/status/osgi-services/${id}`
    );
  }

  async getSlingRequests(serviceName) {
    return await this._rdeClient.doGet(`/runtime/${serviceName}/status/sling-requests`);
  }

  async getSlingRequest(serviceName, id) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/status/sling-requests/${id}`
    );
  }

  async getLogs(id) {
    return await this._rdeClient.doGet(`/runtime/updates/${id}/logs`);
  }

  async getChanges() {
    return await this._rdeClient.doGet(`/runtime/updates`);
  }

  async getChange(id) {
    return await this._rdeClient.doGet(`/runtime/updates/${id}`);
  }

  async getStatus() {
    return await this._rdeClient.doGet(`/runtime/updates/artifacts`);
  }

  async getArtifacts(cursor) {
    const queryString = cursor
        ? `?${new URLSearchParams({ cursor }).toString()}`
        : '';
    return await this._rdeClient.doGet(`/runtime/updates/artifacts${queryString}`);
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
      const result = await this._rdeClient.doPost(`/runtime/updates`, {
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

  async _createError(response) {
    return `Error: ${response.status} - ${await response.text()}`;
  }

  async _putUpdate(changeId, callbackProgress) {
    const change = await handleRetryAfter(
      () => this._rdeClient.doPut(`/runtime/updates/${changeId}`),
      () => this._rdeClient.doGet(`/runtime/updates/${changeId}`),
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
      () => this._rdeClient.doDelete(
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
    return await this._waitForEnv(namespace,'running', 'hibernated');
  }

  async _waitForEnv(namespace, ...allowedStates) {
    return (
      await this._waitForJson(
        (releaseState) => allowedStates.includes(releaseState),
        async () => {
          let status = await this._devConsoleClient.doGet(`/api/releases/${namespace}/status`);
          return status.releases?.status[this._cmReleaseId]?.releaseState;
        }
      )
    );
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
        await this._devConsoleClient.doPost(
          `/api/releases/${namespace}/${target}/${this._cmReleaseId}`
        )
    );
  }

  async _getNamespace() {
    const nameSpaceRequest = await this._devConsoleClient.doGet(`/api/status`);
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
    await this._cloudManagerClient.doPut(`/reset`);
  }

  async _waitForEnvReady() {
    await this._waitForJson(
      (status) => status.status === 'ready',
      async () => await this._cloudManagerClient.doGet('')
    );
  }
}

module.exports = {
  CloudSdkAPI,
};
