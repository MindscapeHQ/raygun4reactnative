# Contributing to Raygun4ReactNative

## Project and library organisation

Building the project requires [Node.js](https://nodejs.org).

The project should work on all LTS Node versions.

All required React Native packages will be installed through `npm`.

- The `raygun4reactnative` package is in the `sdk` folder.
- The `demo` folder contains an example app based on React Native.
- The `ExpoDemo` folder contain an example app based on Expo.

## Building and running

The recommended IDE for working on this project is Visual Studio Code.

Setup instructions can be found in the `sdk` folder in the `README.md` file.

### Tests

To run tests, in the `sdk` folder run `npm run test` or run all tests from VSCode.

### Code analysis

To check the code, in the `sdk` folder run `npm run eslint`.

### Formatting

To format the code, in the `sdk` folder run `npm run prettier`.

### Running examples

Instructions on how to run the examples can be found in their respective folders.

## How to contribute?

This section is intended for external contributors not part of the Raygun team.

Before you undertake any work, please create a ticket with your proposal,
so that it can be coordinated with what we're doing.

If you're interested in contributing on a regular basis,
please get in touch with the Raygun team.

### Fork the repository

Please fork the main repository from https://github.com/MindscapeHQ/raygun4reactnative
into your own GitHub account.

### Create a new branch

Create a local branch off `master` in your fork,
named so that it explains the work in the branch.

Do not submit a PR directly from your `master` branch.

### Open a pull request

Submit a pull request against the main repositories' `master` branch. 

Fill the PR template and give it a title that follows the [Conventional Commits guidelines](https://www.conventionalcommits.org/en/v1.0.0/).

### Wait for a review

Wait for a review by the Raygun team.
The team will leave you feedback and might ask you to do changes in your code.

Once the PR is approved, the team will merge it.

