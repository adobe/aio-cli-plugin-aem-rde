# How to create a release

In order to build a new alpha release and push it to npmjs.com, run the following commands
                                      
    # inside your git clone with the "main" branch checked out
    npm version --preid alpha prerelease
    git push && git push --tags

The `npm version` command updates the version number, creates a new git commit
and tags it. Once the commit is pushed to the upstream repository, deployment
to npmjs.com is automatically performed by the github action
[.github/workflows/on-push-publish-to-npm.yml](.github/workflows/on-push-publish-to-npm.yml).

The progress and status of the deployment can be inspected on the
[Actions tab](//github.com/adobe/aio-cli-plugin-aem-rde/actions).
