# Releasing Raygun4ReactNative

Raygun4ReactNative is published on npmjs.com as [`raygun4reactnative`](https://www.npmjs.com/package/raygun4reactnative).
## Semantic versioning

This package follows semantic versioning.

Given a version number MAJOR.MINOR.PATCH (x.y.z), increment the:

- MAJOR version when you make incompatible changes
- MINOR version when you add functionality in a backward compatible manner
- PATCH version when you make backward compatible bug fixes

To learn more about semantic versioning check: https://semver.org/

## Preparing for release

### Release branch

Create a new branch named `release/x.y.z` 
where `x.y.z` is the Major, Minor and Patch release numbers.

### Update version

Update the `version` in the `src/package.json` file.

### Run npm install

Run `npm install` in the `sdk` to update the version in the `package-lock.json`.

### Update CHANGELOG.md

Add a new entry in the `CHANGELOG.md` file.

Obtain a list of changes using the following git command:

```
git log --pretty=format:"- %s (%as)"
```

### Run publish dry-run

Run a publish dry-run in the `sdk` to ensure no errors appear:

```
npm publish --dry-run
```

### Commit and open a PR

Commit all the changes into a commit with the message `chore: Release x.y.z`
where `x.y.z` is the Major, Minor and Patch release numbers.

Then push the branch and open a new PR, ask the team to review it.

## Publishing

### PR approval

Once the PR has been approved, you can publish the provider.

### Publish to npmjs.com

Run the publish command without `dry-run`.
You will need an account in npmjs.com to publish, 
as well as being part of the [Raygun organization](https://www.npmjs.com/~raygunowner).

```
npm publish
```

Now the package is available for customers.

### Merge PR to master

With the PR approved and the package published, 
squash and merge the PR into `master`.

### Tag and create Github Release

Go to https://github.com/MindscapeHQ/raygun4reactnative/releases and create a new Release.

GitHub will create a tag for you, you don't need to create the tag manually.

You can also generate the release notes automatically.

