'use strict';

const assert = require('assert');
const { runCli, runCliJson } = require('./lib/cli-runner');
const { getE2EConfig } = require('./lib/env');
const {
  bundleUrl,
  bundleSymbolicName,
  packageUrl,
  packageName,
} = require('./lib/fixtures');

const e2e = getE2EConfig();

/**
 * Installs a small, publicly available OSGi bundle and content-package (the
 * Adobe WKND reference site) straight from Maven Central by URL - the
 * `location` arg accepts any publicly reachable http(s) URL directly, so the
 * artifact is streamed server-side and never has to be downloaded onto this
 * machine or committed to the repo.
 *
 * The osgi-bundle install is cleaned up via `aem:rde:delete` in the final
 * test. The content-package install is intentionally left in place:
 * `aem:rde:delete` only supports osgi-bundle/osgi-config, there is no CLI
 * command to uninstall a content-package.
 */
(e2e.enabled ? describe : describe.skip)(
  'E2E: aio aem rde install',
  function () {
    if (!e2e.enabled) {
      console.log(e2e.reason);
      return;
    }

    it('installs an osgi-bundle from a remote URL', async function () {
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
      assert.strictEqual(install.json.items.length, 1);
      assert.strictEqual(install.json.items[0].type, 'osgi-bundle');
      assert.strictEqual(install.json.items[0].status, 'completed');
    });

    it('shows the osgi-bundle as active via aem:rde:inspect:osgi-bundles', async function () {
      this.timeout(e2e.timeoutMs.short);

      // Requires the aem:rde:inspect experimental feature to be enabled in
      // the E2E workspace's local .aio config (see README.md "End-to-end
      // (E2E) testing"), the same way aem:rde:snapshot needs to be.
      const { exitCode, stderr, json } = await runCliJson(
        [
          'aem:rde:inspect:osgi-bundles',
          '--target',
          'author',
          ...e2e.commonFlags,
        ],
        { timeoutMs: e2e.timeoutMs.short, cwd: e2e.cwd }
      );
      assert.strictEqual(
        exitCode,
        0,
        `inspect:osgi-bundles failed:\n${stderr}`
      );
      const bundle = json.items.find(
        (item) => item.symbolicName === bundleSymbolicName
      );
      assert.ok(
        bundle,
        `expected ${bundleSymbolicName} in osgi-bundles, got:\n${JSON.stringify(json.items)}`
      );
      assert.strictEqual(bundle.stateString, 'active');
    });

    it('installs a content-package from a remote URL', async function () {
      this.timeout(e2e.timeoutMs.short);

      // --type must be explicit: unlike local files, a remote zip can't be
      // opened to auto-detect content-package vs dispatcher-config vs frontend.
      const install = await runCliJson(
        [
          'aem:rde:install',
          packageUrl,
          '--type',
          'content-package',
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
      assert.strictEqual(install.json.items.length, 1);
      assert.strictEqual(install.json.items[0].type, 'content-package');
      assert.strictEqual(install.json.items[0].status, 'completed');
    });

    it('cannot delete the content-package - unsupported by aem:rde:delete', async function () {
      this.timeout(e2e.timeoutMs.short);

      // aem:rde:delete only ever looks for osgi-bundle/osgi-config artifacts
      // (see delete.js: `types` defaults to those two, and its `filters`
      // lookup only handles those two) - there is currently no way to remove
      // a content-package via this CLI. Without an explicit --type, it just
      // looks for a bundle/config matching this id, finds none, and fails
      // with DELETE_NOT_FOUND. This test documents that limitation rather
      // than exercising a real deletion.
      const { exitCode, stderr } = await runCli(
        [
          'aem:rde:delete',
          packageName,
          '--target',
          'author',
          ...e2e.commonFlags,
        ],
        { timeoutMs: e2e.timeoutMs.short, cwd: e2e.cwd }
      );
      assert.notStrictEqual(
        exitCode,
        0,
        'expected aem:rde:delete to fail for a content-package id'
      );
      assert.ok(
        stderr.includes('DELETE_NOT_FOUND'),
        `expected a DELETE_NOT_FOUND error, got:\n${stderr}`
      );
    });

    it('deletes the osgi-bundle installed above', async function () {
      this.timeout(e2e.timeoutMs.short);

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
      assert.strictEqual(
        del.json.items[0].deletedArtifact.metadata.bundleSymbolicName,
        bundleSymbolicName
      );

      // The Felix bundle list that inspect:osgi-bundles reads from can lag
      // a few seconds behind the delete API reporting "completed" - poll
      // briefly instead of asserting on the very first read.
      let stillPresent = true;
      let lastInspect;
      const deadline = Date.now() + 20000;
      while (stillPresent && Date.now() < deadline) {
        lastInspect = await runCliJson(
          [
            'aem:rde:inspect:osgi-bundles',
            '--target',
            'author',
            ...e2e.commonFlags,
          ],
          { timeoutMs: e2e.timeoutMs.short, cwd: e2e.cwd }
        );
        assert.strictEqual(
          lastInspect.exitCode,
          0,
          `inspect:osgi-bundles failed:\n${lastInspect.stderr}`
        );
        stillPresent = lastInspect.json.items.some(
          (item) => item.symbolicName === bundleSymbolicName
        );
        if (stillPresent) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
      assert.ok(
        !stillPresent,
        `expected ${bundleSymbolicName} to be gone from osgi-bundles after delete, got:\n${JSON.stringify(lastInspect.json.items)}`
      );
    });
  }
);
