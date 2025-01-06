# Raygun for React Native

The Raygun4ReactNative provider allows you to automatically capture and report 
on unhandled runtime errors within your project by setting up event listeners 
for the JavaScript and platform-native (Android/iOS) sides of your project.

The provider also allows for manual error capturing using the 
`RaygunClient.sendError(...)` function. 
This allows you to customize the data being reported on and capture use cases 
specific to your project.

See more: https://raygun.com/documentation/language-guides/react-native/crash-reporting/features/

## SDK

The `raygun4reactnative` NPM package is located in the `/sdk` folder of this
project.

Follow the instructions in the [README.md](https://github.com/MindscapeHQ/raygun4reactnative/blob/master/sdk/README.md)
file to install it.

NPM Package page: https://www.npmjs.com/package/raygun4reactnative/

## React Native Demo

The folder `/demo` contains a demo React Native application that uses the
`raygun4reactnative` provider.

Instructions on how to run the demo are located in the folder.

## Expo Demo

The folder `/ExpoDemo` contains a demo Expo application that uses the
`raygun4reactnative` provider.

Instructions on how to run the demo are located in the folder.

