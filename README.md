<p align="center">
    <a href="https://raygun.com/" target="_blank" align="center">
        <img src="https://brandfolder.com/raygun/logo/raygun-primary-logo.png" width="500">
    </a>
    <br/>
    <h1>Raygun SDK for React Native</h1>
</p>

# Table of Contents
1. [Requirements](#requirements)
2. [Installations](#installation)
    - [Additional Step for IOS](#additional-step-for-ios)
    - [Additional Step for ANDROID](#additional-step-for-android)
3. [Importing and Instantiation](#importing-and-instantiation)
    - [Example Setup](#example-setup)
4. [API Guide](#api-guide)
    - [Init](#initraygunclientoptions)
        - [Example](#example-init)
    - 

---

# Requirements

```typescript
"react-native": ^0.60.0
```

---

# Installation

To install the package:

```shell script
npm install --save raygun4reactnative
# OR
yarn add raygun4reactnative
```

## Additional Step for iOS

Since our SDK supports native crashes, we need to link the SDK to your native projects.

Modify **Podfile**
```
platform :ios, '10.0'
```
then run
```sh
cd ios && pod install
# OR
npx pod-install ios
```

## Additional Step for Android

Modify the app's **android/app/src/main/AndroidManifest.xml** to include the following line to enable the background Crash Reporting Service & Real-time User monitoring

```html
<application ...>
    ...
    <service
        android:name="com.raygun.raygun4android.services.CrashReportingPostService"
        android:exported="false"
        android:permission="android.permission.BIND_JOB_SERVICE"
        android:process=":crashreportingpostservice"
    />
    <service
        android:name="com.raygun.raygun4android.services.RUMPostService"
        android:exported="false"
        android:permission="android.permission.BIND_JOB_SERVICE"
        android:process=":rumpostservice"
    />
    ...
</application>
```

---

# Importing and Instantiation

Import the RaygunClient using:

```typescript
import RaygunClient from 'raygun4reactnative';
```

Initialize the RaygunClient using the `init(RaygunClientOption)` function.

```typescript
RaygunClient.init(RaygunClientOptions);
```

The RaygunClientOptions is constructed with the following fields:

| Options | Required | Default Value | Description |
| :--- | :------: | :------------ | :---------- |
| apiKey | false | "" | The key provided with a purchased license of the Raygun Client |
| version | false | "" | The version of YOUR application |
| enableCrashReporting | false | false | Enables the usage of Raygun's Crash Reporter |
| disableNativeCrashReporting | false | false | Given you have crash reporting enabled, this disables Crash Reporting from reporting on errors that occur outside the scope of YOUR program |
| enableRealUserMonitoring | false | false | Enables the usage of Raygun's Real User Monitoring |
| disableNetworkMonitoring | false | false | Given you have real user monitoring enabled, this disables the monitor from recording statistics based on Network usage |
| customCrashReportingEndpoint | false | "" | Sends all Crash Reporting information to an alternative address |
| customRealUserMonitoringEndpoint | false | "" | Sends all Real User Monitoring information to an alternative address |
| onBeforeSendingCrashReport | false | null | A handler for crash reports before they are sent (more below) |
| ignoredURLs | false | [] | An array of URLs to ignore. This is utilized with network monitoring, which will be useless without enabling Real User Monitoring (and leaving Network Monitoring enabled) |

It looks a little something like:

```typescript
export type RaygunClientOptions = {
  apiKey?: string;
  version?: string;
  enableCrashReporting?: boolean;
  disableNativeCrashReporting?: boolean;
  enableRealUserMonitoring?: boolean;
  disableNetworkMonitoring?: boolean;
  customCrashReportingEndpoint?: string;
  customRealUserMonitoringEndpoint?: string;
  onBeforeSendingCrashReport?: BeforeSendHandler;
  ignoredURLs?: string[];
}
```

Note: All parameters in the RaygunClientOptions are NOT required.
Any parameter that is not specified will be set to their default / empty values (based on their
type). Thus, you can initialize a client with the like the following example shows:

## Example Setup:
```typescript
// EXAMPLE
import RaygunClient from 'raygun4reactnative'

RaygunClient.init({
  apiKey: "abcd1234",
  enableCrashReporting: true,
  ignoredURLs: ["http://example.com"]
});
```

---

# API Guide

## init(RaygunClientOptions)
The `init` method is used BEFORE doing anything else with the RaygunClient. This is important, as 
all other functionality within the client will rely on the options parsed to it with this method.

#### Example Init:

```typescript
RaygunClient.init({
  apiKey: "This_Is_My_Key",
  version: "0.1.2-beta",
  enableCrashReporting: true,
  disableNativeCrashReporting: false,
  enableRealUserMonitoring: true,
  disableNetworkMonitoring: false,
  customCrashReportingEndpoint: "https://myCrashReportingEndpoint.com",
  customRealUserMonitoringEndpoint: "https://myRealUserMonitoringEndpoint.com",
  onBeforeSendingCrashReport: (crashReport) => console.log(crashReport),
  ignoredURLs: ["http://thisIsAnInternalCall.com", "http://thisIsAnotherInternalCall.com"]
})
```

## addTag(... tags: string[])
The `addTag` method adds tags to the Crash Reports and Real User Monitor. Within the Raygun application, 
you can use these tags to group particular errors together in a manner that aligns with what 
you want.

#### Example addTags

```typescript
RaygunClient.addTag("Invalid_User_Entry", "Caught_Exception");
```


## setUser(user: User | string)