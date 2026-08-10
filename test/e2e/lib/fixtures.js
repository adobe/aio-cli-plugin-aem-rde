'use strict';

/**
 * Shared, publicly available test artifacts (the Adobe WKND reference site)
 * pulled directly from Maven Central by URL - used by multiple E2E specs so
 * no binaries need to be downloaded locally or committed to the repo.
 */

const WKND_VERSION = '4.0.4';
const MAVEN_CENTRAL = 'https://repo1.maven.org/maven2/com/adobe/aem/guides';

module.exports = {
  bundleUrl: `${MAVEN_CENTRAL}/aem-guides-wknd.core/${WKND_VERSION}/aem-guides-wknd.core-${WKND_VERSION}.jar`,
  bundleSymbolicName: 'aem-guides-wknd.core',
  packageUrl: `${MAVEN_CENTRAL}/aem-guides-wknd.ui.apps/${WKND_VERSION}/aem-guides-wknd.ui.apps-${WKND_VERSION}.zip`,
  packageName: 'aem-guides-wknd.ui.apps',
};
