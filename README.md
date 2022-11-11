# aio AEM RDE plugin

This is still work in progress

## Steps for manual testing

1. Clone this repository to a folder.
2. Run `npm install` in the folder.
3. Set your program details like e.g.:

       aio config:set cloudmanager_orgid <org-id>
       aio config:set cloudmanager_programid <program-id>
       aio config:set cloudmanager_environmentid <env-id>

4. Make sure you have `aio` installed.
5. Run `aio login`
6. Run e.g. `aio cloudmanager:list-programs` to test general access
7. Run `aio plugins:link .` inside your folder.
8. Run `aio aem:rde` for help.
9. Run e.g. `aio aem:rde:status` to test the API.

