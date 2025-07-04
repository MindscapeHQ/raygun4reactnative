# Raygun4ReactNative Demo App

This folder contains the demo application for Raygun4ReactNative.

This project uses the sdk package code located in this repository in the `../sdk` folder.

## Setup

We recommend using `npx` to setup and run this demo project.

Install with `npm install -g npx` if not present already in your system.

### Check configuration

Verify your system setup running `npx react-native doctor` and follow the instructions.

### Build SDK

Go to the folder `../sdk` and run `npm install`.

This is necessary since the demo application uses the local sdk package.

### Install dependencies

Run `npm install --install-links` to install the project dependencies.

Note that `--install-links` is required since the package `raygun4reactnative` should be copied over and not linked with a symbolic link, otherwise React-Native won't be able to access it.

### Setup Raygun Options

Configure the `apiKey` from the `RaygunClientOptions` in the `screens/Home.tsx` file.

## Running

1. Run `npx react-native start` to start "metro".
2. In another terminal, run `npx react-native run-android` or `run-ios` to start a simulator and launch the app.
3. Recommened to launch the "Dev Tools" by pressing `j` in the "metro" terminal session.

These commands will take care of starting any necessary background processes, launch an emulator if present, and build and start the app.

If you need to clean the app build data, run `npx react-native clean`.
