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

/**
 * Sleep a defined number of seconds.
 * @param seconds The number of seconds to sleep.
 * @return promise for the sleep duration
 */
function sleepSeconds(seconds) {
  return sleepMillis(seconds * 1000);
}

/**
 * Sleep a defined number of milliseconds.
 * @param millis The number of milliseconds to sleep.
 * @return promise for the sleep duration
 */
function sleepMillis(millis) {
  return millis === 0
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, millis));
}

module.exports = {
  sleepSeconds,
  sleepMillis,
};
