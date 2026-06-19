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

const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');
const chalk = require('chalk');

const CACHE_FILE = 'experimental-features.json';

const TERMS = {
  snapshots: {
    terms:
      'RDE Snapshots is a public beta feature. By using the RDE Snapshots Beta,\n' +
      'you acknowledge that it is still in development and that you should not\n' +
      'rely on the correct functioning of the technology or availability of data.\n' +
      'While we have tested this feature extensively, there is a small possibility\n' +
      'that your RDE could become unstable. If this occurs, a reset will restore\n' +
      'it to a working state.\n' +
      '\n' +
      'Your participation directly helps Adobe identify and resolve\n' +
      'issues — bringing this feature closer to General Availability.\n' +
      '\n' +
      'Continue?',
    disclaimer:
      'RDE Snapshots is a public beta feature. By using the RDE Snapshots Beta,\n' +
      'you acknowledge that it is still in development and that you should not\n' +
      'rely on the correct functioning of the technology or availability of data.',
  },
};

function getAcceptedFeatures(cacheDir) {
  try {
    const filePath = path.join(cacheDir, CACHE_FILE);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Array.isArray(data?.accepted) ? data.accepted : [];
    }
    return [];
  } catch {
    return [];
  }
}

function saveAcceptedFeature(cacheDir, features) {
  const existing = getAcceptedFeatures(cacheDir);
  features.forEach((feature) => {
    if (!existing.includes(feature)) {
      existing.push(feature);
    }
  });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, CACHE_FILE),
    JSON.stringify({ accepted: existing, updatedAt: new Date().toISOString() })
  );
}

function getDisclaimerForFeature(feature) {
  const { disclaimer } = TERMS[feature];
  return disclaimer;
}

async function promptForFeatureAcceptance(features) {
  let allAccepted = true;
  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    const { terms } = TERMS[feature];
    if (!terms) {
      throw new Error(`No terms defined for feature '${feature}'`);
    }
    const { accepted } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'accepted',
        message: chalk.yellow(terms),
        default: false,
      },
    ]);
    allAccepted = allAccepted && accepted;
  }
  return allAccepted;
}

module.exports = {
  getAcceptedFeatures,
  saveAcceptedFeature,
  getDisclaimerForFeature,
  promptForFeatureAcceptance,
};
