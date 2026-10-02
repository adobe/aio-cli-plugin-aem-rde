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
const { sleepSeconds } = require('./utils');
const { DoRequest } = require('./doRequest');
const { codes: internalCodes } = require('./internal-errors');
const { codes: validationCodes } = require('./validation-errors');

const fetch = createFetch();

class CloudSdkAPI {
  /**
   * Initializes a CloudSdkAPI object and returns it.
   *
   * @param {string} cloudManagerUrl the cloudmanager api endpoint
   * @param {string} devConsoleUrl the API-first Developer Console endpoint for the environment
   * @param {string} apiKey the cloudmanager api key
   * @param {string} orgId the cloudmanager org id
   * @param {string} programId The ID of the program that contains the environment.
   * @param {string} environmentId The ID of the environment.
   * @param {string} accessToken The bearer token used to authenticate requests to the API.
   * @param {object} customHeaders Additional headers to send with RDE API calls.
   */
  constructor(
    cloudManagerUrl,
    devConsoleUrl,
    apiKey,
    orgId,
    programId,
    environmentId,
    accessToken,
    customHeaders = {}
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
    const headers = { ...authorizationHeaders, ...customHeaders };
    this._runtimeClient = new DoRequest(`${devConsoleUrl}/runtime`, headers);
    this._environmentClient = new DoRequest(
      `${devConsoleUrl}/rde-runtime`,
      headers
    );
    this._updatesClient = new DoRequest(
      `${devConsoleUrl}/rde-updates`,
      headers
    );
    this._releasesClient = new DoRequest(`${devConsoleUrl}/releases`, headers);
    this._snapshotClient = new DoRequest(
      `${devConsoleUrl}/rde-snapshots`,
      headers
    );
    this.programId = programId;
    this.environmentId = environmentId;
  }

  async getAemLogs(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._runtimeClient.doGet(
      `/${serviceName}/logs${queryString}`
    );
  }

  async getAemLog(serviceName, id) {
    return await this._runtimeClient.doGet(
      `/${serviceName}/logs/${encodeURIComponent(id)}`
    );
  }

  async getAemLogTail(serviceName, id) {
    return await this._runtimeClient.doGet(
      `/${serviceName}/logs/${encodeURIComponent(id)}/tail`
    );
  }

  async createAemLog(serviceName, data) {
    return await this._runtimeClient.doPost(`/${serviceName}/logs`, data);
  }

  async deleteAemLog(serviceName, id) {
    return await this._runtimeClient.doDelete(
      `/${serviceName}/logs/${encodeURIComponent(id)}`
    );
  }

  async getRequestLogs(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._runtimeClient.doGet(
      `/${serviceName}/request-logs${queryString}`
    );
  }

  async getRequestLog(serviceName, id) {
    return await this._runtimeClient.doGet(
      `/${serviceName}/request-logs/${encodeURIComponent(id)}`
    );
  }

  async enableRequestLogs(serviceName, data) {
    return await this._runtimeClient.doPost(
      `/${serviceName}/request-logs`,
      data
    );
  }

  async disableRequestLogs(serviceName) {
    return await this._runtimeClient.doDelete(`/${serviceName}/request-logs`);
  }

  async getInventories(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._runtimeClient.doGet(
      `/${serviceName}/inventory${queryString}`
    );
  }

  async getInventory(serviceName, id) {
    return await this._runtimeClient.doGet(
      `/${serviceName}/inventory/${encodeURIComponent(id)}`
    );
  }

  async getOsgiBundles(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._runtimeClient.doGet(
      `/${serviceName}/osgi-bundles${queryString}`
    );
  }

  async getOsgiBundle(serviceName, id) {
    return await this._runtimeClient.doGet(
      `/${serviceName}/osgi-bundles/${encodeURIComponent(id)}`
    );
  }

  async getOsgiComponents(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._runtimeClient.doGet(
      `/${serviceName}/osgi-components${queryString}`
    );
  }

  async getOsgiComponent(serviceName, componentName) {
    return await this._runtimeClient.doGet(
      `/${serviceName}/osgi-components/${encodeURIComponent(componentName)}`
    );
  }

  async getOsgiConfigurations(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._runtimeClient.doGet(
      `/${serviceName}/osgi-configurations${queryString}`
    );
  }

  async getOsgiConfiguration(serviceName, pId) {
    return await this._runtimeClient.doGet(
      `/${serviceName}/osgi-configurations/${encodeURIComponent(pId)}`
    );
  }

  async getOsgiServices(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return await this._runtimeClient.doGet(
      `/${serviceName}/osgi-services${queryString}`
    );
  }

  async getOsgiService(serviceName, id) {
    return await this._runtimeClient.doGet(
      `/${serviceName}/osgi-services/${encodeURIComponent(id)}`
    );
  }

  async getSnapshotProgress(action, snapshotName, actionid) {
    const params = {
      programId: this.programId,
      environmentId: this.environmentId,
      'snapshot-name': snapshotName,
      action,
      actionid,
    };
    const queryString = this.createUrlQueryStr(params);
    return await this._environmentClient.doGet(`/status${queryString}`);
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
    return await this._snapshotClient.doDelete(
      `/${encodeURIComponent(name)}${queryString}`
    );
  }

  async undeleteSnapshot(name) {
    const params = {
      programId: this.programId,
      environmentId: this.environmentId,
    };
    const queryString = this.createUrlQueryStr(params);
    return await this._snapshotClient.doPut(
      `/${encodeURIComponent(name)}${queryString}`
    );
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

  async restoreSnapshot(name, params) {
    const queryString = this.createUrlQueryStr({
      programId: this.programId,
      environmentId: this.environmentId,
    });
    return await this._snapshotClient.doPost(
      `/${encodeURIComponent(name)}/restore${queryString}`,
      params
    );
  }

  async getLogs(id) {
    return await this._updatesClient.doGet(`/${encodeURIComponent(id)}/logs`);
  }

  async getChanges() {
    return await this._updatesClient.doGet('');
  }

  async getChange(id) {
    return await this._updatesClient.doGet(`/${encodeURIComponent(id)}`);
  }

  async getStatus() {
    return await this._updatesClient.doGet('/artifacts');
  }

  async getArtifacts(cursor) {
    const queryString = this.createUrlQueryStr({ cursor });
    return await this._updatesClient.doGet(`/artifacts${queryString}`);
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
    const result = await this._updatesClient.doPost('', {
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
      uploadCallbacks?.start(fileSize);
      const result = await this._updatesClient.doPost('', {
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
        uploadCallbacks?.progress(progress);
        let time = 0;
        while (res.copyId !== copyId || res.copyStatus === 'pending') {
          await sleepSeconds(1);
          if (time++ > 30 && progress === 0) {
            await client.abortCopyFromURL(copyId);
            uploadCallbacks?.abort();
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
            uploadCallbacks?.progress(Math.max(progress, fakeProgress));
          }
        }

        if (res.copyStatus !== 'success') {
          uploadCallbacks?.abort();
          uploadCallbacks?.start(
            fileSize,
            'Direct URL transfer failed. Attempting download of the provided URL and upload of the file to RDE.'
          );
          const con = await fetch(url);
          await client.uploadStream(con.body, fileSize, 1024 * 1024, 4, {
            onProgress: (progress) =>
              uploadCallbacks?.progress(progress.loadedBytes),
          });
        }
        return await this._putUpdate(changeId, deploymentCallback);
      } else {
        uploadCallbacks?.abort();
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
      () => this._updatesClient.doPut(`/${encodeURIComponent(changeId)}`),
      () => this._updatesClient.doGet(`/${encodeURIComponent(changeId)}`),
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
        this._updatesClient.doDelete(
          `/artifacts/${encodeURIComponent(id)}` + (force ? `?force=true` : '')
        ),
      (previousResponse) =>
        previousResponse
          .json()
          .then((json) =>
            this._updatesClient.doGet(`/${encodeURIComponent(json.updateId)}`)
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

  async _waitForEnvRunning() {
    await this._waitForEnv('running');
  }

  async _waitForEnvHibernated() {
    await this._waitForEnv('hibernated');
  }

  async _waitForEnvRunningOrHibernated() {
    return await this._waitForEnv('running', 'hibernated');
  }

  async _waitForEnv(...allowedStates) {
    const getReleaseState = (json) => {
      const state = json.status?.releaseState;
      if (typeof state !== 'string') {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [200, 'Release status response has no releaseState'],
        });
      }
      return state;
    };
    const json = await this._waitForJson(
      (json) => allowedStates.includes(getReleaseState(json)),
      () => this._releasesClient.doGet('/status')
    );
    return getReleaseState(json);
  }

  async _hibernateEnv() {
    await this._setEnvStatus('hibernate');
  }

  async _dehibernateEnv() {
    await this._setEnvStatus('dehibernate');
  }

  async _setEnvStatus(target) {
    await this._waitForJson(
      (status) => status.ok,
      () => this._releasesClient.doPost(`/${target}`)
    );
  }

  async _checkRDE() {
    const response = await this.getArtifacts(`limit=0`);
    if (response.status !== 200) {
      throw await this._createError(response);
    }
  }

  async _startEnv() {
    await this._dehibernateEnv();
    await this._waitForEnvRunning();
  }

  async _stopEnv() {
    await this._hibernateEnv();
    await this._waitForEnvHibernated();
  }

  async startEnv() {
    await this._checkRDE();
    const status = await this._waitForEnvRunningOrHibernated();
    if (status === 'hibernated') {
      await this._startEnv();
    } else {
      throw new internalCodes.ENVIRONMENT_NOT_HIBERNATED();
    }
  }

  async stopEnv() {
    await this._checkRDE();
    const status = await this._waitForEnvRunningOrHibernated();
    if (status === 'running') {
      await this._stopEnv();
    } else {
      throw new internalCodes.ENVIRONMENT_NOT_RUNNING();
    }
  }

  async restartEnv() {
    const response = await this._environmentClient.doPost('/restart', {});
    if (response.status !== 201) {
      throw await this._createError(response);
    }
    const tries = 3;
    for (let i = 0; i < tries; i++) {
      await sleepSeconds(5);
      await this._waitForEnvRunning();
    }
  }

  async resetEnv(wait, keepMutableContent, force) {
    await this._checkRDE();

    // later we should fold everything into the RDE API and not use the CM API
    if (keepMutableContent || force) {
      const result = await this._environmentClient.doPost('/reset', {
        'keep-mutable-content': keepMutableContent,
        force,
      });

      if (result.status !== 201) {
        throw await this._createError(result);
      }

      const tries = 3;
      for (let i = 0; i < tries; i++) {
        await sleepSeconds(5);
        await this._waitForEnvRunning();
      }
    } else {
      await this._waitForCMStatus();
      await this._cloudManagerClient.doPut(`/reset`);
      if (wait) {
        return await this._waitForCMStatus();
      }
    }
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
