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
const { handleRetryAfter } = require('./rde-utils');
const { sleepSeconds, concatEnvironemntId } = require('./utils');
const { DoRequest } = require('./doRequest');
const { codes: internalCodes } = require('./internal-errors');
const { codes: validationCodes } = require('./validation-errors');

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
    this._devConsoleClient = new DoRequest(devConsoleUrl, authorizationHeaders);
    this._rdeClient = new DoRequest(
      `${rdeUrl}/program/${programId}/environment/${environmentId}`,
      authorizationHeaders
    );
    this._snapshotClient = new DoRequest(
      `${rdeUrl}/snapshots`,
      authorizationHeaders
    );
    this.programId = programId;
    this.environmentId = environmentId;
    this._cmReleaseId = concatEnvironemntId(programId, environmentId);
  }

  async getAemLogs(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/logs${queryString}`
    );
  }

  async getAemLog(serviceName, id) {
    return await this._rdeClient.doGet(`/runtime/${serviceName}/logs/${id}`);
  }

  async getAemLogTail(serviceName, id) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/logs/${id}/tail`
    );
  }

  async createAemLog(serviceName, data) {
    return await this._rdeClient.doPost(`/runtime/${serviceName}/logs`, data);
  }

  async deleteAemLog(serviceName, id) {
    return await this._rdeClient.doDelete(`/runtime/${serviceName}/logs/${id}`);
  }

  async getRequestLogs(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/request-logs${queryString}`
    );
  }

  async getRequestLog(serviceName, id) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/request-logs/${id}`
    );
  }

  async enableRequestLogs(serviceName, data) {
    return await this._rdeClient.doPost(
      `/runtime/${serviceName}/request-logs`,
      data
    );
  }

  async disableRequestLogs(serviceName) {
    return await this._rdeClient.doDelete(
      `/runtime/${serviceName}/request-logs`
    );
  }

  async getInventories(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/inventory${queryString}`
    );
  }

  async getInventory(serviceName, id) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/inventory/${id}`
    );
  }

  async getOsgiBundles(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/osgi-bundles${queryString}`
    );
  }

  async getOsgiBundle(serviceName, id) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/osgi-bundles/${id}`
    );
  }

  async getOsgiComponents(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/osgi-components${queryString}`
    );
  }

  async getOsgiComponent(serviceName, componentName) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/osgi-components/${componentName}`
    );
  }

  async getOsgiConfigurations(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/osgi-configurations${queryString}`
    );
  }

  async getOsgiConfiguration(serviceName, pId) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/osgi-configurations/${pId}`
    );
  }

  async getOsgiServices(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/osgi-services${queryString}`
    );
  }

  async getOsgiService(serviceName, id) {
    return await this._rdeClient.doGet(
      `/runtime/${serviceName}/osgi-services/${id}`
    );
  }

  async getSnapshots() {
    const params = {
      programId: this.programId,
      environmentId: this.environmentId,
    };
    const queryString = this.createUrlQueryStr(params);
    return await this._snapshotClient.doGet(`${queryString}`);
  }

  async deleteSnapshot(name, force) {
    const params = {
      force,
      programId: this.programId,
      environmentId: this.environmentId,
    };
    const queryString = this.createUrlQueryStr(params);
    return await this._snapshotClient.doDelete(`/${name}${queryString}`);
  }

  async restoreSnapshot(name) {
    const params = {
      programId: this.programId,
      environmentId: this.environmentId,
    };
    const queryString = this.createUrlQueryStr(params);
    return await this._snapshotClient.doPut(`/${name}${queryString}`);
  }

  async createSnapshot(name, params) {
    params = {
      ...params,
      'snapshot-name': name,
      programId: this.programId,
      environmentId: this.environmentId,
    };
    const queryString = this.createUrlQueryStr(params);
    return await this._snapshotClient.doPost(`${queryString}`);
  }

  async applySnapshot(name, params) {
    params = {
      ...params,
      programId: this.programId,
      environmentId: this.environmentId,
    };
    const queryString = this.createUrlQueryStr(params);
    return await this._snapshotClient.doPost(`/${name}/apply${queryString}`);
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
    const queryString = this.createUrlQueryStr({ cursor });
    return await this._rdeClient.doGet(
      `/runtime/updates/artifacts${queryString}`
    );
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
    const result = await this._rdeClient.doPost(`/runtime/updates`, {
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
      uploadCallbacks?.start(fileSize);
      await client.uploadFile(path, {
        onProgress: (progress) =>
          uploadCallbacks?.progress(progress.loadedBytes),
      });
      return await this._putUpdate(changeId, deploymentCallback);
    } else {
      uploadCallbacks?.abort();
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
          uploadCallbacks.abort();
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

  async _createError(
    response,
    DefaultError = internalCodes.UNEXPECTED_API_ERROR
  ) {
    let errMessage = response.statusText;
    try {
      errMessage = await response.text();
    } catch (err) {}

    if (errMessage) {
      switch (errMessage) {
        case 'Concurrent modification':
          throw new validationCodes.CONCURRENT_MODIFICATION();
        case 'Deployment in progress':
          throw new validationCodes.DEPLOYMENT_IN_PROGRESS();
      }
    }

    throw new DefaultError({
      messageValues: [response.status, errMessage],
    });
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
      () =>
        this._rdeClient.doDelete(
          `/runtime/updates/artifacts/${id}` + (force ? `?force=true` : '')
        ),
      (previousResponse) =>
        previousResponse
          .json()
          .then((json) =>
            this._rdeClient.doGet(`/runtime/updates/${json.updateId}`)
          )
    );
    if (change.status === 200) {
      return await change.json();
    } else {
      throw await this._createError(change);
    }
  }

  createUrlQueryStr(params) {
    const queryString = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        queryString.append(key, value);
      }
    }
    return `?${queryString}`;
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

  async _waitForEnv(namespace, ...allowedStates) {
    const getReleaseState = (json) =>
      json.releases?.status[this._cmReleaseId]?.releaseState;
    const json = await this._waitForJson(
      (json) => allowedStates.includes(getReleaseState(json)),
      () => this._devConsoleClient.doGet(`/api/releases/${namespace}/status`)
    );
    return getReleaseState(json);
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
        throw new internalCodes.NAMESPACE_NOT_FOUND();
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
      throw new internalCodes.ENVIRONMENT_NOT_HIBERNATED();
    }
  }

  async stopEnv() {
    await this._checkRDE();
    const namespace = await this._getNamespace();
    const status = await this._waitForEnvRunningOrHibernated(namespace);
    if (status === 'running') {
      await this._stopEnv(namespace);
    } else {
      throw new internalCodes.ENVIRONMENT_NOT_RUNNING();
    }
  }

  async restartEnv() {
    const response = await this._rdeClient.doPost(`/runtime/restart`, {});
    if (response.status !== 201) {
      throw await this._createError(response);
    }
    const namespace = await this._getNamespace();
    const tries = 3;
    for (let i = 0; i < tries; i++) {
      await sleepSeconds(5);
      await this._waitForEnvRunning(namespace);
    }
  }

  async resetEnv(wait) {
    await this._checkRDE();
    await this._waitForCMStatus();
    await this._resetEnv();
    if (wait) {
      return await this._waitForCMStatus();
    }
  }

  async _resetEnv() {
    await this._cloudManagerClient.doPut(`/reset`);
  }

  async cleanEnv(wait, params) {
    await this._checkRDE();
    await this._waitForEnvReady();
    await this._cleanEnv();
    if (wait) {
      await this._waitForEnvReady();
    }
  }

  async _cleanEnv(params) {
    const queryString = this.createUrlQueryStr(params);
    await this._rdeClient.doPut(`/clean${queryString}`);
  }

  async _waitForCMStatus() {
    const json = await this._waitForJson(
      (status) => status.status === 'ready' || status.status === 'reset_failed',
      async () => await this._cloudManagerClient.doGet('')
    );
    return json.status;
  }
}

module.exports = {
  CloudSdkAPI,
};
