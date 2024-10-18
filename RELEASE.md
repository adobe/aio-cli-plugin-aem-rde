# How to create a release

In order to build a new release and push it to npmjs.com, run the following commands

    # inside your git clone with the "main" branch checked out, ensure to have latest code locally after some PR merges
    git checkout main
    git pull
    npm version [<newversion> | major | minor | patch]
    git push && git push --tags

The `npm version` command updates the version number, creates a new git commit
and tags it. Once the commit is pushed to the upstream repository, deployment
to npmjs.com is automatically performed by the github action
[.github/workflows/on-push-publish-to-npm.yml](.github/workflows/on-push-publish-to-npm.yml).

The progress and status of the deployment can be inspected on the
[Actions tab](//github.com/adobe/aio-cli-plugin-aem-rde/actions).
