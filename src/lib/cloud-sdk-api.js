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

const fetch = createFetch();

class CloudSdkAPI {
  _request;

  constructor(request) {
    this._request = request;
  }

  async getAemLogs(serviceName) {
    return this._request.doGet(`/runtime/${serviceName}/logs`);
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

  async getRequestLogs(serviceName) {
    return this._request.doGet(`/runtime/${serviceName}/request-logs`);
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

  async getInventories(serviceName) {
    return this._request.doGet(`/runtime/${serviceName}/status/inventory`);
  }

  async getInventory(serviceName, id) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/inventory/${id}`
    );
  }

  async getOsgiBundles(serviceName) {
    return this._request.doGet(`/runtime/${serviceName}/status/osgi-bundles`);
  }

  async getOsgiBundle(serviceName, id) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-bundles/${id}`
    );
  }

  async getOsgiComponents(serviceName) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-components`
    );
  }

  async getOsgiComponent(serviceName, componentName) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-components/${componentName}`
    );
  }

  async getOsgiConfigurations(serviceName) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-configurations`
    );
  }

  async getOsgiConfiguration(serviceName, pId) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-configurations/${pId}`
    );
  }

  async getOsgiService(serviceName) {
    return this._request.doGet(`/runtime/${serviceName}/status/osgi-services`);
  }

  async getOsgiService(serviceName, id) {
    return this._request.doGet(
      `/runtime/${serviceName}/status/osgi-services/${id}`
    );
  }

  async getSlingRequests(serviceName) {
    return this._request.doGet(`/runtime/${serviceName}/status/sling-requests`);
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
    return this._request.doGet(`/runtime/updates`);
  }

  async getChange(id) {
    return this._request.doGet(`/runtime/updates/${id}`);
  }

  async getStatus() {
    return this._request.doGet(`/runtime/updates/artifacts`);
  }

  async deployFile(
    fileSize,
    path,
    name,
    type,
    target,
    contentPath,
    force,
    callbackCopy,
    callbackProgress
  ) {
    let result = await this._request.doPost(`/runtime/updates`, {
      service: target,
      fileSize: fileSize,
      type: type,
      metadata: { name: name },
      contentPath: contentPath,
      force: force,
    });

    if (result.status === 201) {
      let url = result.headers.get('Location');
      let changeId = (await result.json()).updateId;
      let client = new ShareFileClient(url);
      callbackCopy(0, fileSize);
      await client.uploadFile(path, {
        onProgress: (progress) => {
          callbackCopy(progress.loadedBytes, fileSize);
        },
      });

      let change = await this._request.doPut(`/runtime/updates/${changeId}`);

      while (change.status === 202) {
        callbackProgress();
        await this.delay(change.headers.get('Retry-After'));
        change = await this._request.doGet(`/runtime/updates/${changeId}`);
      }
      if (change.status === 200) {
        return await change.json();
      } else {
        throw `Error: ${change.status} - ${change.statusText}`;
      }
    } else {
      throw `Error: ${result.status} - ${result.statusText}`;
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
    callbackCopy,
    callbackProgress
  ) {
    if (fileSize > 0) {
      let result = await this._request.doPost(`/runtime/updates`, {
        service: target,
        fileSize: fileSize,
        type: type,
        metadata: { name: name },
        contentPath: contentPath,
        force: force,
      });

      if (result.status === 201) {
        let clientUrl = result.headers.get('Location');
        let changeId = (await result.json()).updateId;
        let client = new ShareFileClient(clientUrl);
        let res = await client.startCopyFromURL(url);
        let copyId = res.copyId;

        let getProgressBytes = (copyProgress) => {
          return copyProgress
            ? parseInt(copyProgress.slice(0, copyProgress.indexOf('/')))
            : 0;
        };

        let progress = getProgressBytes(res.copyProgress);
        callbackCopy(progress, fileSize);
        let time = 0;
        while (res.copyId !== copyId || res.copyStatus === 'pending') {
          await this.delay(1000);
          if (time++ > 20 && progress === 0) {
            await client.abortCopyFromURL(copyId);
          }
          res = await new ShareFileClient(clientUrl).getProperties();
          if (res.copyProgress) {
            progress = getProgressBytes(res.copyProgress);

            // URL deployments have quite large chunk sizes, so it can
            // be a while before the first chunk is uploaded. Let's indicate
            // that progress is happening, even though we haven't got the
            // numbers yet. Fake progress is limited to max 1/3 of the file
            // size.
            let fakeProgress = Math.round((time * fileSize) / 60);
            callbackCopy(Math.max(progress, fakeProgress), fileSize);
          }
        }

        if (res.copyStatus !== 'success') {
          let con = await fetch(url);
          await client.uploadStream(con.body, fileSize, 1024 * 1024, 4, {
            onProgress: (progress) =>
              callbackCopy(progress.loadedBytes, fileSize),
          });
        }

        let change = await this._request.doPut(`/runtime/updates/${changeId}`);

        while (change.status === 202) {
          callbackProgress();
          await this.delay(change.headers.get('Retry-After'));
          change = await this._request.doGet(`/runtime/updates/${changeId}`);
        }
        if (change.status === 200) {
          return await change.json();
        } else {
          throw `Error: ${change.status} - ${change.statusText}`;
        }
      } else {
        throw `Error: ${result.status} - ${result.statusText}`;
      }
    } else {
      throw Error('Can not get file size from head request');
    }
  }

  async delete(id, force) {
    let change = await this._request.doDelete(
      `/runtime/updates/artifacts/${id}` + (force ? `?force=true` : '')
    );
    while (change.status === 202) {
      await this.delay();
      let changeId = (await change.json()).updateId;
      change = await this._request.doGet(`/runtime/updates/${changeId}`);
    }
    if (change.status === 200) {
      return await change.json();
    } else {
      throw `Error: ${change.status} - ${change.statusText}`;
    }
  }

  delay(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }
}

module.exports = {
  CloudSdkAPI: CloudSdkAPI,
};
