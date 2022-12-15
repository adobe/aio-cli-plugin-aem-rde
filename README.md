# aio-cli-plugin-aem-rde
[Adobe I/O CLI](https://github.com/adobe/aio-cli) Plugin for interactions with
AEM Rapid Development Environments. 

# Requirements

* [Adobe I/O CLI](https://github.com/adobe/aio-cli)
* Node.js version compatibility:
   * 16.x -- 16.13.0 or higher.
   * 18.x -- 18.0.0 or higher.
   * Use with odd Node versions is *not* recommended.

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

## Verifying configuration

1. Run `aio login`
2. Run `aio aem:rde` for general help.
3. Run `aio aem:rde:install --help ` for help about a specific command.
4. Run `aio aem:rde:status` to see if the configured environment can be accessed.

## Steps for testing local modifications

1. Clone this repository to a folder.
2. Run `npm install` in the folder.
3. Run `aio plugins:link .` inside your folder.

