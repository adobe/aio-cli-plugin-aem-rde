const Config = require('@adobe/aio-lib-core-config');

let update = function(type, key) {
  return function (hiddenFeatures) {
    let filtered = this.config[type].filter(
        (e) => !hiddenFeatures.find((h) => e[key].startsWith(h))
    );
    const removedCount = this.config[type].length - filtered.length;
    if (removedCount !== 0) {
      this.config[`_${type}`] = filtered.reduce((acc, e) => {
        acc.set(e[key], e);
        return acc;
      }, new Map());
      return true;
    }
    return false;
  };
};

const descriptors = {
  topics: {
    update: update('topics', 'name'),
  },
  commands: {
    update: function(hiddenFeatures) {
      if (update('commands', 'id').call(this, hiddenFeatures)) {
        this.config._commandIDs = this.config.commands.map((c) => c.id);
      }
    }
  },
  flags: {
    update: function(hiddenFeatures) {
      for (let i = 0; i < hiddenFeatures.length; i++) {
        let [commandId, flag] = hiddenFeatures[i].split('#');
        let command = this.config['_commands'].get(commandId);
        if (command && flag) {
          delete command.flags[flag];
        }
      }
    },
  }
};

/**
 * @param type
 * @param hiddenFeatures
 */
function toggleExperimentalFeatures(type, hiddenFeatures) {
  const descriptor = descriptors[type];
  if (hiddenFeatures.length > 0 && descriptor) {
    descriptor.update.call(this, hiddenFeatures);
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
    toggleExperimentalFeatures.call(this, 'flags', hidden);
  }
};
