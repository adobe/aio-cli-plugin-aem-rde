'use strict';

const assert = require('assert');
const { runCliJson } = require('./lib/cli-runner');
const { getE2EConfig } = require('./lib/env');
const { bundleUrl, bundleSymbolicName } = require('./lib/fixtures');

const e2e = getE2EConfig();

/**
 * Fast smoke test: confirms login + config + connectivity are all in place
 * before the (much slower, destructive) snapshot lifecycle suite runs.
 */
(e2e.enabled ? describe : describe.skip)(
  'E2E: aio aem rde status',
  function () {
    if (!e2e.enabled) {
      console.log(e2e.reason);
      return;
    }

    it('reports the configured program/environment as reachable', async function () {
      this.timeout(e2e.timeoutMs.short);

      const { exitCode, stderr, json } = await runCliJson(
        ['aem:rde:status', ...e2e.commonFlags],
        { timeoutMs: e2e.timeoutMs.short, cwd: e2e.cwd }
      );

      assert.strictEqual(exitCode, 0, `status command failed:\n${stderr}`);
      assert.strictEqual(String(json.programId), String(e2e.programId));
      assert.strictEqual(String(json.environmentId), String(e2e.environmentId));
      assert.ok(json.status, 'expected a status field in the JSON result');
    });

    describe('after installing an osgi-bundle', function () {
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

      it('lists it under author.osgiBundles, then drops it again after delete', async function () {
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

        const afterInstall = await runCliJson(
          ['aem:rde:status', ...e2e.commonFlags],
          { timeoutMs: e2e.timeoutMs.short, cwd: e2e.cwd }
        );
        assert.strictEqual(
          afterInstall.exitCode,
          0,
          `status failed:\n${afterInstall.stderr}`
        );
        assert.ok(
          afterInstall.json.author.osgiBundles.some(
            (bundle) =>
              bundle.metadata.bundleSymbolicName === bundleSymbolicName
          ),
          `expected ${bundleSymbolicName} in status author.osgiBundles`
        );

        const del = await runCliJson(
          [
            'aem:rde:delete',
            bundleSymbolicName,
            '--target',
            'author',
            ...e2e.commonFlags,
          ],
          { timeoutMs: e2e.timeoutMs.short, cwd: e2e.cwd }
        );
        assert.strictEqual(del.exitCode, 0, `delete failed:\n${del.stderr}`);

        const afterDelete = await runCliJson(
          ['aem:rde:status', ...e2e.commonFlags],
          { timeoutMs: e2e.timeoutMs.short, cwd: e2e.cwd }
        );
        assert.strictEqual(
          afterDelete.exitCode,
          0,
          `status failed:\n${afterDelete.stderr}`
        );
        assert.ok(
          !afterDelete.json.author.osgiBundles.some(
            (bundle) =>
              bundle.metadata.bundleSymbolicName === bundleSymbolicName
          ),
          `expected ${bundleSymbolicName} to be gone from status author.osgiBundles after delete`
        );
      });
    });
  }
);
