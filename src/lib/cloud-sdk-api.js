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
const { handleRetryAfter, sleepSeconds } = require('./rde-utils');

const fetch = createFetch();

class CloudSdkAPI {
  constructor(request) {
    this._request = request;
  }

  async getAemLogs(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return this._request.doGet(`/runtime/${serviceName}/logs${queryString}`);
  }

  async getAemLog(serviceName, id) {
    return this._request.doGet(`/runtime/${serviceName}/logs/${id}`);
  }

  async getAemLogTail(serviceName, id) {
    return this._request.doGet(`/runtime/${serviceName}/logs/${id}/tail`);
  }

  async createAemLog(serviceName, data) {
    return this._request.doPost(`/runtime/${serviceName}/logs`, data);
  }

  async deleteAemLog(serviceName, id) {
    return this._request.doDelete(`/runtime/${serviceName}/logs/${id}`);
  }

  async getRequestLogs(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return this._request.doGet(
      `/runtime/${serviceName}/request-logs${queryString}`
    );
  }

  async getRequestLog(serviceName, id) {
    return this._request.doGet(`/runtime/${serviceName}/request-logs/${id}`);
  }

  async enableRequestLogs(serviceName, data) {
    return this._request.doPost(`/runtime/${serviceName}/request-logs`, data);
  }

  async disableRequestLogs(serviceName) {
    return this._request.doDelete(`/runtime/${serviceName}/request-logs`);
  }

  async getInventories(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return this._request.doGet(
      `/runtime/${serviceName}/status/inventory${queryString}`
    );
  }

  async getInventory(serviceName, id) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/inventory/${id}`
    );
  }

  async getOsgiBundles(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-bundles${queryString}`
    );
  }

  async getOsgiBundle(serviceName, id) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-bundles/${id}`
    );
  }

  async getOsgiComponents(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-components${queryString}`
    );
  }

  async getOsgiComponent(serviceName, componentName) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-components/${componentName}`
    );
  }

  async getOsgiConfigurations(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-configurations${queryString}`
    );
  }

  async getOsgiConfiguration(serviceName, pId) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-configurations/${pId}`
    );
  }

  async getOsgiServices(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-services${queryString}`
    );
  }

  async getOsgiService(serviceName, id) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-services/${id}`
    );
  }

  async getSlingRequests(serviceName, params) {
    const queryString = this.createUrlQueryStr(params);
    return this._request.doGet(
      `/runtime/${serviceName}/status/sling-requests${queryString}`
    );
  }

  async getSlingRequest(serviceName, id) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/sling-requests/${id}`
    );
  }

  async getLogs(id) {
    return this._request.doGet(`/runtime/updates/${id}/logs`);
  }

  async getChanges() {
    return await this._request.doGet(`/runtime/updates`);
  }

  async getChange(id) {
    return await this._request.doGet(`/runtime/updates/${id}`);
  }

  async getArtifacts(cursor) {
    const queryString = this.createUrlQueryStr({ cursor });
    return await this._request.doGet(
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
    const result = await this._request.doPost(`/runtime/updates`, {
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
      return await this._request.putUpdate(changeId, deploymentCallback);
    } else {
      uploadCallbacks.abort();
      throw new Error(`Error: ${result.status} - ${result.statusText}`);
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
      const result = await this._request.doPost(`/runtime/updates`, {
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
          if (time++ > 20 && progress === 0) {
            await client.abortCopyFromURL(copyId);
            break;
          }
          res = await new ShareFileClient(clientUrl).getProperties();
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
        throw new Error(`Error: ${result.status} - ${result.statusText}`);
      }
    } else {
      throw Error('Can not get file size from head request');
    }
  }

  async _putUpdate(changeId, callbackProgress) {
    const change = await handleRetryAfter(
      () => this._request.doPut(`/runtime/updates/${changeId}`),
      () => this._request.doGet(`/runtime/updates/${changeId}`),
      callbackProgress
    );
    if (change.status === 200) {
      return await change.json();
    } else {
      throw new Error(`Error: ${change.status} - ${change.statusText}`);
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
          .then((json) =>
            this._request.doGet(`/runtime/updates/${json.updateId}`)
          )
    );
    if (change.status === 200) {
      return await change.json();
    } else {
      throw new Error(`Error: ${change.status} - ${change.statusText}`);
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
}

module.exports = {
  CloudSdkAPI,
};
