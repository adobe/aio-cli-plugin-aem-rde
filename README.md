# aio-cli-plugin-aem-rde

[Adobe I/O CLI](https://github.com/adobe/aio-cli) Plugin for interactions with
AEM Rapid Development Environments.

# Requirements

- [Adobe I/O CLI](https://github.com/adobe/aio-cli)
- Node.js version compatibility:
  - 16.x -- 16.13.0 or higher.
  - 18.x -- 18.0.0 or higher.
  - Use with odd Node versions is _not_ recommended.

# Installation

```
$ aio plugins:install @adobe/aio-cli-plugin-aem-rde
```

# Updating

```
$ aio plugins:update
```

# Getting started

# Configuration

The plugin needs to be configured to point to an existing RDE environment as follows:

```
 $ aio config:set cloudmanager_orgid <org-id>
 $ aio config:set cloudmanager_programid <program-id>
 $ aio config:set cloudmanager_environmentid <env-id>
```

> **Note**:
> If you are planning to work with multiple environments, we highly recommend you to use the flag `-l` or `--local` together with the `config:set` so that you will store the configuration in the local directory (i.e. the config is only effective in the current directory). For details on different config locations refer to [aio-lib-core-config's README](https://github.com/adobe/aio-lib-core-config#persistent-file-locations).

## Configuration for `aio aem rde inspect` commands *
⚠️ * **WARNING**: This is an **experimental feature**! It may not work, may not (yet) be available and may be removed without notice. ⚠️


### Enable `aio aem rde inspect` commands

Remove the following line from your `package.json` file:

```
   "experimental-features": ["aem:rde:inspect"], 
```

### Add user access token to the configuration

When calling the commands under the `inspect` topic the plugin needs additional configurations.

1. Go to Skyline Developer Console of your environment: `https://dev-console-ns-team-aem-cm-stg-n0000.ethos00-stage-va7.dev.adobeaemcloud.com/#release-cm-p00000-e000000` or use the `aio cloudmanager:environment:open-developer-console` command
2. Go to _Integrations_ tab.
3. Go to _Local token_ sub-tab and click on _Get Local Development Token_ button.
4. Copy the _accessToken_: `eyJhbGciOiJSUzI1NiIsIng1dSI.....`
5. Go to terminal and do the following:

```
$ aio aem rde inspect setup <paste access token here>
```

## Verifying configuration

1. Run `aio login`
2. Run `aio aem:rde` for general help.
3. Run `aio aem:rde:install --help ` for help about a specific command.
4. Run `aio aem:rde:status` to see if the configured environment can be accessed.

Only if `inspect` topic is [enabled](#configuration-for-aio-aem-rde-inspect-commands).

5. Run `aio aem:rde:inspect --help` to see if the inspect command can be accessed.
6. Run `aio aem:rde:inspect:logs` to see if the authorization with the set token works.

## Running unit tests

1. Run `npm run test`

This both runs the mocha-based unit tests as well as produces a test report table at the end.
A more detailed test report can be found in the `coverage/index.html` file.

## Steps for testing local modifications

1. Clone this repository to a folder.
2. Run `npm install` in the folder.
3. Run `aio plugins:link .` inside your folder.
