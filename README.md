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
3. [API Guide](#api-guide)
    - [Instantiation](#instantiating-the-client)
    - [Init](#initraygunclientoptions)
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

# API Guide

**IMPORTANT INFORMATION**
The client must be instantiated and initialized before using the rest of the 

## Instantiating the client

An instance of the RaygunClient is created by importing the client from the package.

#### Example
```typescript
import RaygunClient from "raygun4reactnative"
```
This instance will be used to call action upon the rest of the API interface. Be sure to `init` your
instance BEFORE using the other functions within the API.  


## init(RaygunClientOptions)
The `init` function must be used BEFORE doing anything else with the RaygunClient. This is important, as 
all other functionality within the client will rely on the options parsed to it with this function.

Multithreading: This function, by default, is NOT asynchronous. BEWARE, as asynchronously calling 
this method may lead to some undesirable outcomes. The `init` method needs to finish before all other
methods.

#### Example
```typescript
import RaygunClient, {RaygunClientOptions} from "raygun4reactnative"

const options: RaygunClientOptions = {
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
};

RaygunClient.init(options);
```

After successfully calling the init function, the client has been instantiated and initialized. 
Now the other functions provided by the client will be able to run. 

## addTag(... tags: string[])
The `addTag` function adds tags to the Crash Reports and Real User Monitor. Within the Raygun application, 
you can use these tags to group particular errors together in a manner that aligns with what 
you want.

#### Example addTags

```typescript
RaygunClient.addTag("Invalid_User_Entry", "Caught_Exception");
```


## setUser(user: User | string)
