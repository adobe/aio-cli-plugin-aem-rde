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
'use strict';

const { codes: internalCodes } = require('./internal-errors');
const { codes: deploymentErrorCodes } = require('./deployment-errors');
const { codes: deploymentWarningCodes } = require('./deployment-warnings');
const { withRetries } = require('./doRequest');
const { sleepSeconds } = require('./utils');

const STATUS = {
  WAITING: 'waiting',
  PROCESSING: 'processing',
  STAGED: 'staged',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * @param change
 * @param basecommand
 */
function logChange(change, basecommand) {
  basecommand.doLog(
    `#${change.updateId}: ${change.action} ${change.status}` +
      (change.deletedArtifact
        ? ` for ${change.deletedArtifact.type} ${
            change.deletedArtifact.type === 'osgi-bundle'
              ? change.deletedArtifact.metadata.bundleSymbolicName
              : change.deletedArtifact.metadata.configPid
          }`
        : `${
            change.metadata && change.metadata.name
              ? ' for ' + change.type + ' ' + change.metadata.name
              : ''
          }`) +
      (change.type === 'dispatcher-config'
        ? ' on dispatcher'
        : change.services
          ? ` on ${change.services}`
          : '') +
      ` - done by ${change.user} at ${change.timestamps.received}`,
    true
  );
}

/**
 * @param changeType
 */
function getRetryConfigPerType(changeType) {
  if (changeType) {
    switch (changeType) {
      case 'dispatcher-config':
        return {
          retries: 30,
          waitSeconds: 1,
        };
      case 'frontend':
        return {
          retries: 90,
          waitSeconds: 1,
        };
    }
  }
  return {
    retries: 20,
    waitSeconds: 1,
  };
}

/**
 * @param cloudSdkAPI
 * @param updateId
 * @param progressCallback
 */
async function throwOnInstallError(cloudSdkAPI, updateId, progressCallback) {
  progressCallback(false, 'retrieving update status');
  const response = await handleRetryAfter(
    null,
    () => cloudSdkAPI.getChange(updateId),
    () => progressCallback(false, 'checking status')
  );
  progressCallback(true);

  if (response.status === 200) {
    const change = await response.json();
    if (change) {
      switch (change.status) {
        case STATUS.FAILED:
          throw new deploymentErrorCodes.INSTALL_FAILED();
        case STATUS.STAGED:
          throw new deploymentWarningCodes.INSTALL_STAGED();
        default:
          // no error exception is thrown
          return;
      }
    }
  }

  throw new Error(
    `cannot check command operation status, error code ${
      response ? response.status : 'unknown'
    } and error message ${response ? response.statusText : 'unknown'}`
  );
}

/**
 * @param cloudSdkAPI
 * @param updateId
 * @param cli
 * @param basecommand
 * @param progressCallback
 * @param jsonResultItem
 */
async function loadUpdateHistory(
  cloudSdkAPI,
  updateId,
  basecommand,
  progressCallback,
  jsonResultItem
) {
  progressCallback(false, 'retrieving update status');
  let response = await handleRetryAfter(
    null,
    () => cloudSdkAPI.getChange(updateId),
    () => progressCallback(false, 'update is in progress')
  );
  progressCallback(true);

  if (response.status === 200) {
    progressCallback(false, 'retrieving update logs');
    const change = await response.json();
    if (jsonResultItem) {
      if (Array.isArray(jsonResultItem)) {
        // assume that when this is an array, there is no item for this update yet. Create it so that the logs can be added further below.
        const newLength = jsonResultItem.push(change);
        jsonResultItem = jsonResultItem[newLength - 1];
      }
    }
    const retryConfig = getRetryConfigPerType(change.type);
    // requesting logs for a dispatcher-config update may cause an intermittent 404 response
    response = await withRetries(
      () => cloudSdkAPI.getLogs(updateId),
      (response) => response.status !== 404,
      retryConfig.waitSeconds,
      retryConfig.retries
    );
    const retrySeconds = retryConfig.waitSeconds * retryConfig.retries;
    progressCallback(true);
    if (!response) {
      basecommand.doLog(
        `No logs have become available within the retry period of ${retrySeconds} seconds.`
      );
      basecommand.doLog(
        `Please run "aio aem:rde:history ${updateId}" to check for progress manually.`
      );
    } else if (response.status === 200) {
      logChange(change, basecommand);
      const log = await response.text();
      let lines = null;

      // JSON is only supported for legacy reasons and can eventually be removed
      if (log.trim().startsWith('[') && log.trim().endsWith(']')) {
        try {
          lines = JSON.parse(log);
        } catch (err) {
          // ignore
        }
      }

      if (lines === null) {
        lines = log.split(/\n/).filter((line) => line.trim().length > 0);
      }

      if (jsonResultItem) {
        jsonResultItem.logs = [];
      }
      if (lines.length > 0) {
        basecommand.doLog(`Logs:`, true);
        lines.forEach((line) => {
          basecommand.doLog(`> ${line}`, true);
          if (jsonResultItem) {
            jsonResultItem.logs.push(line);
          }
        });
      } else {
        basecommand.doLog('No logs available for this update.', true);
        if (jsonResultItem) {
          jsonResultItem.logs.push('No logs available for this update.');
        }
      }
    } else {
      throw new internalCodes.UNEXPECTED_API_ERROR({
        messageValues: [response.status, response.statusText],
      });
    }
  } else if (response.status === 404) {
    basecommand.doLog(`An update with ID ${updateId} does not exist.`);
  } else {
    throw new internalCodes.UNEXPECTED_API_ERROR({
      messageValues: [response.status, response.statusText],
    });
  }
}

/**
 * @param cloudSdkAPI
 */
async function loadAllArtifacts(cloudSdkAPI) {
  let hasMore = true;
  let cursor;
  let status;
  const items = [];
  while (hasMore) {
    const response = await cloudSdkAPI.getArtifacts(cursor);
    if (response.status === 200) {
      const json = await response.json();
      status = json.status;
      cursor = json.cursor;
      hasMore = json.cursor !== undefined;
      items.push(...json.items);
    } else {
      throw new internalCodes.UNEXPECTED_API_ERROR({
        messageValues: [response.status, response.statusText],
      });
    }
  }
  return {
    status,
    items,
  };
}

/**
 * @param artifacts
 */
function groupArtifacts(artifacts) {
  const groupedArtifacts = {
    author: { 'osgi-bundle': [], 'osgi-config': [] },
    publish: { 'osgi-bundle': [], 'osgi-config': [] },
  };
  artifacts.reduce((acc, curr) => {
    ((acc[curr.service] ||= {})[curr.type] ||= []).push(curr);
    return acc;
  }, groupedArtifacts);
  return groupedArtifacts;
}

/**
 * @param mutableRequestClosure
 * @param requestClosure
 * @param beforeSleepCallback
 */
async function handleRetryAfter(
  mutableRequestClosure,
  requestClosure,
  beforeSleepCallback
) {
  let retryDelay;
  let response;
  do {
    response =
      response === undefined && mutableRequestClosure
        ? await mutableRequestClosure()
        : await requestClosure(response);
    retryDelay = response.headers.get('Retry-After');
    const delay = parseInt(retryDelay, 10);
    if (!Number.isNaN(delay)) {
      beforeSleepCallback && beforeSleepCallback();
      await sleepSeconds(Math.min(delay, 5)); // wait no more than 5 sec
    }
  } while (retryDelay);
  return response;
}

module.exports = {
  logChange,
  throwOnInstallError,
  loadUpdateHistory,
  loadAllArtifacts,
  groupArtifacts,
  handleRetryAfter,
};
