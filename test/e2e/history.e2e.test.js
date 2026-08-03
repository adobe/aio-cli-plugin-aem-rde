'use strict';

const assert = require('assert');
const { runCliJson } = require('./lib/cli-runner');
const { getE2EConfig } = require('./lib/env');
const { bundleUrl, bundleSymbolicName } = require('./lib/fixtures');

const e2e = getE2EConfig();

/**
 * Installs (then removes) the shared osgi-bundle fixture to generate a real
 * update, and confirms `aem:rde:history` lists it and `aem:rde:history <id>`
 * returns that update's own details.
 */
(e2e.enabled ? describe : describe.skip)(
  'E2E: aio aem rde history',
  function () {
    if (!e2e.enabled) {
      console.log(e2e.reason);
      return;
    }

    let updateId;

    after(async function () {
      this.timeout(e2e.timeoutMs.short);
      try {
        await runCliJson(
          [
            'aem:rde:delete',
            bundleSymbolicName,
            '--target',
            'author',
            ...e2e.commonFlags,
          ],
          { timeoutMs: e2e.timeoutMs.short, cwd: e2e.cwd }
        );
      } catch {
        // ignore - may already be gone
      }
    });

    it('installs the osgi-bundle fixture to generate an update', async function () {
      this.timeout(e2e.timeoutMs.short);

      const install = await runCliJson(
        [
          'aem:rde:install',
          bundleUrl,
          '--type',
          'osgi-bundle',
          '--target',
          'author',
          ...e2e.commonFlags,
        ],
        { timeoutMs: e2e.timeoutMs.short, cwd: e2e.cwd }
      );
      assert.strictEqual(
        install.exitCode,
        0,
        `install failed:\n${install.stderr}`
      );
      updateId = install.json.items[0].updateId;
      assert.ok(updateId, 'expected an updateId in the install result');
    });

    it('lists the update as part of the full history', async function () {
      this.timeout(e2e.timeoutMs.short);

      const { exitCode, stderr, json } = await runCliJson(
        ['aem:rde:history', ...e2e.commonFlags],
        { timeoutMs: e2e.timeoutMs.short, cwd: e2e.cwd }
      );
      assert.strictEqual(exitCode, 0, `history failed:\n${stderr}`);
      assert.ok(Array.isArray(json.items), 'expected an items array');
      const entry = json.items.find((item) => item.updateId === updateId);
      assert.ok(entry, `expected update ${updateId} in history`);
      assert.strictEqual(entry.type, 'osgi-bundle');
    });

    it('gets the details for that specific update', async function () {
      this.timeout(e2e.timeoutMs.short);

      const { exitCode, stderr, json } = await runCliJson(
        ['aem:rde:history', updateId, ...e2e.commonFlags],
        { timeoutMs: e2e.timeoutMs.short, cwd: e2e.cwd }
      );
      assert.strictEqual(exitCode, 0, `history ${updateId} failed:\n${stderr}`);
      assert.strictEqual(json.items.length, 1);
      assert.strictEqual(json.items[0].updateId, updateId);
      assert.strictEqual(json.items[0].type, 'osgi-bundle');
    });
  }
);
