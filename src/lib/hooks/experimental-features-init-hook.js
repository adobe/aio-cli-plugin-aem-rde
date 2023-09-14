const Config = require('@adobe/aio-lib-core-config');

const descriptors = {
  topics: {
    key: 'name',
  },
  commands: {
    key: 'id',
    afterUpdate: function () {
      this.config._commandIDs = this.config.commands.map((c) => c.id);
    },
  },
};

/**
 * @param type
 * @param hiddenFeatures
 */
function toggleExperimentalFeatures(type, hiddenFeatures) {
  const descriptor = descriptors[type];
  const key = descriptor.key;
  if (hiddenFeatures.length > 0) {
    const filtered = this.config[type].filter(
      (e) => !hiddenFeatures.find((h) => e[key].startsWith(h))
    );
    const removedCount = this.config[type].length - filtered.length;
    if (removedCount !== 0) {
      this.config[`_${type}`] = filtered.reduce((acc, e) => {
        acc.set(e[key], e);
        return acc;
      }, new Map());

      if (typeof descriptor.afterUpdate === 'function') {
        descriptor.afterUpdate.call(this);
      }
    }
  }
}

module.exports = async function () {
  const plugin = this.config.plugins.find(
    (p) => p.name === '@adobe/aio-cli-plugin-aem-rde'
  );
  if (plugin) {
    const experimentalFeatures =
      plugin.pjson.oclif['experimental-features'] || [];
    const enabled = Config.get('aem-rde.experimental-features') || [];
    const hidden = experimentalFeatures.filter((e) => !enabled.includes(e));
    toggleExperimentalFeatures.call(this, 'topics', hidden);
    toggleExperimentalFeatures.call(this, 'commands', hidden);
  }
};
