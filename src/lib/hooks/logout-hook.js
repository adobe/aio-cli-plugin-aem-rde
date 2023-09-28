const Config = require('@adobe/aio-lib-core-config');

module.exports = async function (options) {
  if (options.Command.id === 'auth:logout') {
    Config.delete('aem-rde.inspect.ims_access_token');
  }
};
