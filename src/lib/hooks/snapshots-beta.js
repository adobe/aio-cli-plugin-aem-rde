const inquirer = require('inquirer');
const fs = require('node:fs')

const hook = async function (options) {
  let commandId = options.Command.id;
  if (commandId.startsWith("aem:rde:snapshot")) {

    let cacheDir = this.config.cacheDir;
    let file = `${this.config.cacheDir}/snapshots-beta.json`;
    //writeFileSync(`${this.config.cacheDir}/${options.fileName}.json`, JSON.stringify(options.nameList))
    let json = {};
    if (fs.existsSync(file)) {
      let raw = fs.readFileSync(file).toString('utf8');
      json = JSON.parse(raw);
    }

    if (!json.accepted) {
      const { acceptSnapshotBeta } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'acceptSnapshotBeta',
          message:
            'RDE Snapshots is a public beta feature. By using the RDE Snapshots Beta, you acknowledge that it is ' +
            'still in development and that you should not rely on the correct functioning of the technology or ' +
            'availability of data. While we have tested this feature extensively, there is a small possibility ' +
            'that your RDE could become unstable. If this occurs, a reset will restore it to a working state.\n' +
            '\n' +
            'Your participation directly helps Adobe identify and resolve issues — bringing this feature closer ' +
            'to General Availability.\n' +
            '\n' +
            'Continue?',
          default: false,
        },
      ]);
      if (!acceptSnapshotBeta) {
        options.Command.run = () => {
          console.log(
            'In order to use RDE Snapshots, currently a beta feature, you need to opt in.'
          );
        };
      } else {
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir);
        }
        fs.writeFileSync(
          file,
          JSON.stringify({ accepted: true, date: new Date() })
        );
      }
    }
    return Promise.resolve();
  }
}

module.exports = hook;