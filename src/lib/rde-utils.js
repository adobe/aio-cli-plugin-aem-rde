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

const { CliUx } = require('@oclif/core');

function sleepSeconds(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function logChange(change) {
    CliUx.ux.log(`#${change.updateId}: ${change.action} ${change.status}` + (change.deletedArtifact ? ` for ${change.deletedArtifact.type} ${change.deletedArtifact.type === 'osgi-bundle' ? change.deletedArtifact.metadata.bundleSymbolicName : change.deletedArtifact.metadata.configPid}` :
            `${change.metadata && change.metadata.name ? ' for ' + change.type + ' ' + change.metadata.name : ''}`
    ) + (change.type === 'dispatcher-config' ? ' on dispatcher' : (change.services ? ` on ${change.services}` : '')) + ` - done by ${change.user} at ${change.timestamps.received}`)
}

async function loadUpdateHistory(cloudSdkAPI, updateId, cli, progressCallback) {
    progressCallback(false, 'retrieving update status');
    let response = await handleRetryAfter(
        null,
        () => cloudSdkAPI.getChange(updateId),
        () => progressCallback(false, 'update is in progress'))
    progressCallback(true);

    if (response.status === 200) {
        progressCallback(false, 'retrieving update logs');
        let change = await response.json();
        // requesting logs for a dispatcher-config update may cause an intermittent 404 response
        response = await withRetries(
            () => cloudSdkAPI.getLogs(updateId),
            response => response.status !== 404,
            1,
            20
        );
        progressCallback(true);
        if (!response) {
            cli.log(`No logs have become available within the retry period of 20 seconds.`)
            cli.log(`Please run "aio aem:rde:history ${updateId}" to check for progress manually.`)
        } else if (response.status === 200) {
            logChange(change);
            let log = await response.text();
            let lines = null;

            // JSON is only supported for legacy reasons and can eventually be removed
            if (log.trim().startsWith('[') && log.trim().endsWith(']')) {
                try {
                    lines = JSON.parse(log)
                } catch (err) {
                    // ignore
                }
            }

            if (lines === null) {
                lines = log.split(/\n/).filter(line => line.trim().length > 0)
            }

            if (lines.length > 0) {
                cli.log(`Logs:`)
                lines.forEach((line) => {
                    cli.log(`> ${line}`)
                })
            } else {
                cli.log('No logs available for this update.')
            }
        } else {
            cli.log(`Error: ${response.status} - ${response.statusText}`)
        }
    } else if (response.status === 404) {
        cli.log(`An update with ID ${updateId} does not exist.`);
    } else {
        cli.log(`Error: ${response.status} - ${response.statusText}`)
    }
}

async function loadAllArtifacts(cloudSdkAPI) {
    let hasMore = true
    let cursor = undefined
    let status = undefined
    let items = []
    while (hasMore) {
        let response = await cloudSdkAPI.getArtifacts(cursor)
        if (response.status === 200) {
            let json = await response.json()
            status = json.status
            cursor = json.cursor
            hasMore = json.cursor !== undefined
            items.push(...json.items)
        } else {
            throw `Error: ${response.status} - ${response.statusText}`
        }
    }
    return {
        status,
        items
    }
}

function groupArtifacts(artifacts) {
    let groupedArtifacts = {
        'author': { 'osgi-bundle': [], 'osgi-config': [] },
        'publish': { 'osgi-bundle': [], 'osgi-config': [] }
    }
    artifacts.reduce((acc, curr) => {
        ((acc[curr.service] ||= {})[curr.type] ||= []).push(curr)
        return acc
    }, groupedArtifacts)
    return groupedArtifacts;
}

async function handleRetryAfter(mutableRequestClosure, requestClosure, beforeSleepCallback) {
    let retryDelay;
    let response = undefined;
    do {
        response = (response === undefined && mutableRequestClosure ? await mutableRequestClosure() : await requestClosure(response));
        retryDelay = response.headers.get('Retry-After');
        let delay = parseInt(retryDelay, 10);
        if (!Number.isNaN(delay)) {
            beforeSleepCallback && beforeSleepCallback();
            await sleepSeconds(Math.min(delay, 5)); // wait no more than 5 sec
        }
    } while(retryDelay)
    return response
}

async function withRetries(closure, successPredicate, retryIntervalSeconds, maxRetries) {
    for (let i = 0; i < maxRetries; i++) {
        let result = await closure()
        if (successPredicate(result)) {
            return result
        }
        await sleepSeconds(retryIntervalSeconds)
    }
}

module.exports = {
    sleepSeconds,
    logChange,
    loadUpdateHistory,
    loadAllArtifacts,
    groupArtifacts,
    handleRetryAfter
}
