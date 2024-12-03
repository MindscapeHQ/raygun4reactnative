# Raygun SDK for React Native

## Table of contents

1. [Requirements](#requirements)
2. [Installations](#installation)
    - [Additional step for IOS](#additional-step-for-ios)
    - [Additional step for ANDROID](#additional-step-for-android)
    - [Manual integration](#manual-integration)
    - [Additional Public Documentation](#additional-public-documentation)
3. [API guide](#api-guide)
    - [Important information](#important-information)
    - [Using the client](#using-the-client)
        - [init](#initraygunclientoptions)
        - [setTags](#settags-tags-string)
        - [getTags](#gettags-string)
        - [setUser](#setuseruser-user--null)
        - [getUser](#getuser-user)
        - [recordBreadcrumb](#recordbreadcrumbbreadcrumb-breadcrumb)
        - [getBreadcrumbs](#getbreadcrumbs-breadcrumb)
        - [clearBreadcrumbs](#clearbreadcrumbs)
        - [setCustomData](#setcustomdatacustomdata-customdata--null)
        - [getCustomData](#getcustomdata-customdata--null)
        - [sendError](#senderrorerror-error-details-manualcrashreportdetails)
        - [setMaxReportsStoredOnDevice](#setmaxreportsstoredondevicesize-number)
        - [sendRUMTimingEvent](#sendrumtimingeventeventtype-realusermonitoringtimings-name-string-timeusedinms-number)
    - [Raygun specific types](#raygun-specific-types)
        - [BeforeSendHandler](#beforesendhandler)
        - [Breadcrumb](#breadcrumb)
        - [CrashReportPayload](#crashreportpayload)
        - [CustomData](#customdata)
        - [Environment](#environment)
        - [LogLevel](#loglevel)
        - [ManualCrashReportDetails](#manualcrashreportdetails)
        - [RaygunClientOptions](#raygunclientoptions)
        - [RaygunStackFrame](#raygunstackframe)
        - [RealUserMonitoringTimings](#realusermonitoringtimings)
        - [User](#user)
    - [Native Crash Reporting](#native-crash-reporting)
    - [Generating Sourcemaps](#generating-sourcemaps)

---

# Requirements

```json
{
  "react-native": "^0.60.0",
  "@react-native-async-storage/async-storage": "^1.13.3"
}
```

---

# Installation

To install the package:

```shell script
npm install --save raygun4reactnative
# OR
yarn add raygun4reactnative
```

<br/>

### Additional step for iOS

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

<br/>
<br/>

### Additional step for Android

Modify the app's **android/app/src/main/AndroidManifest.xml** to include the following line to
enable the background Crash Reporting Service & Real-time User monitoring

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

## Manual Integration

React-Native projects should load the native components of Raygun4ReactNative automatically.

If for some reason your project is not able to load the Android and iOS modules code, for example if you are using an old architecture, you can follow these steps to load the native code.

> [!IMPORTANT]  
> This step is only necessary if your project is not loading the native code automatically, e.g. you are getting a "DEVICE_ID is null exception" on start.

### iOS

1. Enter into iOS Folder `cd ios/` (on your project's root folder).

2. Add this line to your `Podfile` just below the last pod (if you don't have one, you can create it by running `pod init`):

```
+ pod 'raygun4reactnative', :path => '../node_modules/raygun4reactnative'
```

3. Run `pod install`.

### Android

1. Add the project to `android/settings.gradle`:

```
rootProject.name = 'MyApp'

include ':app'

+ include ':raygun4reactnative'
+ project(':raygun4reactnative').projectDir = new File(rootProject.projectDir, '../node_modules/raygun4reactnative/android')
```

2. In `android/app/build.gradle` add to dependencies:

```
dependencies {
  ...
+ implementation project(':@raygun4reactnative')
}
```

3. Then, in `android/app/src/main/java/your/package/MainApplication.java`:

```
package com.myapp;

+ import com.raygun.react.RaygunNativeBridgePackage;
...

@Override
protected List<ReactPackage> getPackages() {
    return Arrays.<ReactPackage>asList(
        new MainReactPackage(),
+       new RaygunNativeBridgePackage()
    );
}
```

### Additional Public Documentation

[Crash Reporting Installation](https://raygun.com/documentation/language-guides/react-native/crash-reporting/installation/) <br/>
[Crash Reporting Features](https://raygun.com/documentation/language-guides/react-native/crash-reporting/features/) <br/>
[Real User Monitoring Installation](https://raygun.com/documentation/language-guides/react-native/real-user-monitoring/installation/) <br/>
[Real USer Monitoring Features](https://raygun.com/documentation/language-guides/react-native/real-user-monitoring/features/)

---

# API guide

## Important information

The client must be instantiated and initialized before using the rest of the API. Failing to do so
will result in a lack of functionality (this will be logged out to the system - this means that
during testing it will appear where console.logs appear).

## Using the client

An instance of the RaygunClient is created by importing the client from the package.

```typescript
import RaygunClient from "raygun4reactnative"
```

This instance will be used to call action upon the rest of the API interface. Be sure to `init` your
instance BEFORE using the other functions within the API.

<br/>
<br/>

### init(RaygunClientOptions)

The `init` function must be used BEFORE doing anything else with the RaygunClient. This is
important, as all other functionality within the client will rely on the options parsed to it with
this function.

Multithreading: This function, by default, is NOT asynchronous. BEWARE, as asynchronously calling
this method may lead to some undesirable outcomes. The `init` method needs to finish before all
other methods.

See also:<br/>
[BeforeSendHandler](#beforesendhandler)<br/>
[LogLevel](#loglevel)<br/>
[RaygunClientOptions](#raygunclientoptions)

```typescript
import RaygunClient, {RaygunClientOptions, LogLevel} from "raygun4reactnative"

const options: RaygunClientOptions = {
  apiKey: "INSERT_YOUR_API_KEY_HERE",
  version: "0.1.2",
  enableCrashReporting: true,
  disableNativeCrashReporting: false,
  disableUnhandledPromiseRejectionReporting: false,
  enableRealUserMonitoring: true,
  disableNetworkMonitoring: false,
  customCrashReportingEndpoint: "https://myCrashReportingEndpoint.com",
  customRealUserMonitoringEndpoint: "https://myRealUserMonitoringEndpoint.com",
  ignoredURLs: ["http://thisIsAnInternalCall.com", "http://thisIsAnotherInternalCall.com"],
  ignoredViews: ["name of view to ignore"],
  logLevel: LogLevel.verbose,
  onBeforeSendingCrashReport: (crashReport) => console.log(crashReport),
  maxErrorReportsStoredOnDevice: 10,
  maxBreadCrumbsPerErrorReport: 10,
};

RaygunClient.init(options);
```

After successfully calling the init function, the client has been instantiated and initialized. Now
the other functions provided by the client will be able to run.

<br/>
<br/>

### setTags(... tags: string[])

The `setTags` function set the global tags for the Raygun client. All crash reports and real user
monitoring packages will be attached with these tags, such that they can be searched for in the
Raygun.com dashboard. To remove all tags, simply parse this method nothing.

[Find out more here!](https://raygun.com/documentation/product-guides/crash-reporting/custom-data-tags/)

```typescript
import RaygunClient from "raygun4reactnative"

RaygunClient.setTags("Invalid_User_Entry", "Caught_Exception");

// Reset tags
RaygunClient.setTags();
```

<br/>
<br/>

### getTags(): string[]

The `getTags` returns all the global tags that are currently set in the Raygun client.

Tip: To append more tags to the global set, use the get method to retrieve an array of currently
existing tags, concat the extra tags onto the list, and call the `setTags` function again.

[Find out more here!](https://raygun.com/documentation/product-guides/crash-reporting/custom-data-tags/)

```typescript
import RaygunClient from "raygun4reactnative"

const globalTags: string[] = RaygunClient.getTags();
```

<br/>
<br/>

### setUser(user: User | null)

The `setUser` function is parsed a User object. Setting the user is an important step in maintaining
a Real User Monitoring session. By updating the User, the following rules are applied:

- anonymous_user -> user_1 => Current session is updated with the user data.
- user_1 -> user_2 => Current session ends. A new session begins with user_2 information.
- user_1 -> anonymous_user => Current sessions ends. A new session begins.

Note, if `null` is parsed to this method, the user is set to an anonymous user.
<br/>

[Find out more here!](https://raygun.com/documentation/product-guides/real-user-monitoring/for-mobile/users/)

See also:<br/>
[User](#user)

```typescript
import RaygunClient, {User} from "raygun4reactnative"

const user: User = {
  identifier: 'ronald@raygun.com',
  isAnonymous: false,
  email: 'ronald@raygun.com',
  firstName: 'Ronald',
  fullName: 'Ronald Raygun',
  uuid: 'uuid'
}

RaygunClient.setUser(user);

// Reset to anonymous user
RaygunClient.setUser(null);
```

<br/>
<br/>

### getUser(): User

The `getUser` function returns the current user.
<br/>
[Find out more here!](https://raygun.com/documentation/product-guides/real-user-monitoring/for-mobile/users/)

See also:<br/>
[User](#user)

```typescript
import RaygunClient, {User} from "raygun4reactnative"

const curUser: User = RaygunClient.getUser();
```

<br/>
<br/>

### recordBreadcrumb(breadcrumb: Breadcrumb)

The `recordBreadcurmb` function appends a breadcrumb to the global set of breadcrumbs. These
breadcrumbs are attached to all Crash Reports. Breadcrumbs are useful when debugging code, if you
leave a trail of breadcrumbs as your code progresses, then you can determine the state of the
program right before the crash occurred.

See also:<br/>
[Breadcrumb](#breadcrumb)

```typescript
import RaygunClient, {Breadcrumb} from "raygun4reactnative"

const breadCrumb: Breadcrumb = {
  message: "Hansel and Gretel #1",
  category: "FairyTales",
  level: 'warning',
  customData: {"House Materials": ["GingerBread", "GumDrops"]},
  timestamp: Date.now(),
  type: 'manual',
}

RaygunClient.recordBreadcrumb(breadCrumb);
```

<br/>
<br/>

### getBreadcrumbs(): Breadcrumb[]

The `getBreadcrumbs` function returns an array of the current global set of breadcrumbs.

See also:<br/>
[Breadcrumb](#breadcrumb)

```typescript
import RaygunClient, {Breadcrumb} from "raygun4reactnative"

const globalBreadcrumbs: Breadcrumb[] = RaygunClient.getBreadcrumbs();
```

<br/>
<br/>

### clearBreadcrumbs()

The `clearBreadcrumbs` function removes all the globally set breadcrumbs.

```typescript
import RaygunClient, from "raygun4reactnative"

RaygunClient.clearBreadcrumbs();
```

<br/>
<br/>

### sendError(error: Error, details?: ManualCrashReportDetails)

The `sendError` function manually sends an error to your Raygun dashboard. By default, the crash
reporter will capture all unhandled errors, and send them through to Raygun, however in some cases,
an error shouldn't be thrown as the program can still persist. If you have caught some error, you
can utilize this method, and send the error through to Raygun. Appended to this error is a
ManualCrashReportDetails object. This non-mandatory object can apply specific tags and CustomData to
the error you are sending away as well as the global tags and CustomData.

See also:<br/>
[CustomData](#customdata)
<br/>
[ManualCrashReportDetails](#manualcrashreportdetails)

```typescript
import RaygunClient, {ManualCrashReportDetails} from "raygun4reactnative"

try {
  // some action that might throw an error
  throw new Error("Something went wrong");
} catch (e) {
  const localDetails: ManualCrashReportDetails = {
    customData: {"Local": "Tried to attempt action A, but failed"},
    tags: ["Action A", "Local"]
  }

  RaygunClient.sendError(e, localDetails);

  // Alternatively, if you don't wish to append any local data
  RaygunClient.sendError(e);
}
```

<br/>
<br/>

### setCustomData(customData: CustomData | null)

The `setCustomData` function will set the global custom data object to the parsed parameter. When
any error occurs, this custom data will be attached to all crash reports. If you parse `null` to
this function, the global custom data will be reset.

See also:<br/>
[CustomData](#customdata)

```typescript
import RaygunClient, {CustomData} from "raygun4reactnative"

const customData: CustomData = {"Key": "Value"};

RaygunClient.setCustomData(customData);

// To reset custom data object
RaygunClient.setCustomData(null);
```

<br/>
<br/>

### getCustomData(): CustomData | null

The `getCustomData` function will return the current, global custom data object that has been set.
If no custom data object exists, then the function will return null.

See also:<br/>
[CustomData](#customdata)

```typescript
import RaygunClient, {CustomData} from "raygun4reactnative"

const customData: CustomData | null = RaygunClient.getCustomData();
```

<br/>
<br/>

### setMaxReportsStoredOnDevice(size: number)

The `setMaxReportsStoredOnDevice` function will determine how many crash reports are stored on the
device. A crash report is stored when the user is unable to connect to Raygun.com. Upon launching
the application again, the reports that are stored are attempted to be sent.

Note, although any number can be parsed through this value, the maximum amount of stored crash
reports is capped at 64. The minimum is 0. Parsing 0 (or less) will mean, no crash reports are
stored on the device at all. The default starting value is 64.

```typescript
import RaygunClient from "raygun4reactnative"

RaygunClient.setMaxReportsStoredOnDevice(10); // Sets the amount to 10

// Alternatively
RaygunClient.setMaxReportsStoredOnDevice(100); // Sets the amount to 64
RaygunClient.setMaxReportsStoredOnDevice(-100); // Sets the amount to 0
```

<br/>
<br/>

### sendRUMTimingEvent(eventType: RealUserMonitoringTimings, name: string, durationMs: number)

The `sendRUMTimingEvent` function manually sends a new timing event to Real User Monitoring. Parsing
in a
`RealUserMonitoringTiming` event, the name of the event, and the duration of the event. This can be
used to monitor the load times of particular components or fetch times of network requests.

By default, if Real User Monitoring is enabled, all network events are captured and sent to Raygun.
However, if you choose to disable this through the `init` method, then you can still send away
network timing events using this function.

See also:
[RealUserMonitoringTimings](#realusermonitoringtimings)

```typescript
import RaygunClient, {RealUserMonitoringTimings} from "raygun4reactnative"

// Monitoring some activity
RaygunClient.sendRUMTimingEvent(RealUserMonitoringTimings.ViewLoaded, 'name of the activity event', 1000);

// Monitoring a network call
RaygunClient.sendRUMTimingEvent(RealUserMonitoringTimings.NetworkCall, 'name of the network event', 255);
```

---

## Raygun specific types

This segment outlines the type declarations for some Raygun4ReactNative specific objects. Each of
these object types can be imported into your program and used (as the examples throughout the rest
of the API guide show).

<br/>

### BeforeSendHandler

The `BeforeSendHandler` acts as an intermediate function between your application and Raygun. This
function is parsed a CrashReportPayload and returns a CrashReportPayload or Null. Before the
CrashReportPayload is sent to Raygun, this function will be called to apply some logic to the
report. If `null` or other invalid object is returned, then the report is ignored (not sent to
Raygun).

See also:<br/>
[CrashReportPayload](#crashreportpayload)

```typescript
export type BeforeSendHandler = (payload: CrashReportPayload) => CrashReportPayload | null;
```

<br/>
<br/>

### Breadcrumb

The `Breadcrumb` type is a container for simple pieces of information that are used to aid with
identifying issues. These are sent away with a CrashReportPayload.

[Find out more here!](https://raygun.com/documentation/product-guides/crash-reporting/breadcrumbs/)

See also:<br/>
[CrashReportPayload](#crashreportpayload)<br/>
[CustomData](#customdata)

```typescript
export type Breadcrumb = {
  message: string;
  category?: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  customData?: CustomData;
  timestamp?: number;
  type?: 'manual'
};
```

<br/>
<br/>

### CrashReportPayload

The `CrashReportPayload` is only accessible within the `BeforeSendHandler` function. This reference
should aid in designing an intermediate function. It acts as a container for basic information about
some environment where a crash occurred. This may give you some insight to the error.

See also:<br/>
[Breadcrumb](#breadcrumb)<br/>
[CustomData](#customdata)<br/>
[Environment](#environment)<br/>
[RaygunStackFrame](#raygunstackframe)<br/>
[User](#user)

```typescript
export type CrashReportPayload = {
  OccurredOn: Date;
  Details: {
    Error: {
      ClassName: string;
      Message: string;
      StackTrace: RaygunStackFrame[];
      StackString: string;
    };
    Environment: Environment;
    Client: {
      Name: string;
      Version: string;
    };
    UserCustomData: CustomData;
    Tags?: string[];
    User?: User;
    Breadcrumbs?: Breadcrumb[];
    Version: string;
  };
};
```

<br/>
<br/>

### CustomData

The `CustomData` type is a restricted object that only allows for basic object types. Treat
it as though it was a JSON object to send through with your crash report.

[Find out more here!](https://raygun.com/documentation/product-guides/crash-reporting/custom-data-tags/)

```typescript
export type CustomData = {
  [key: string]: BasicType | CustomData | BasicType[] | CustomData[];
};

// For reference (this is not an available type in the API)
const BasicType = string | number | boolean;
```

<br/>
<br/>

### Environment

The `Environment` type is accessible in a `BeforeSendHandler` function via the `CrashReportPayload`
parameter. It acts as a container for all variables related to the current system environment. The
structure below should aid if this information would be helpful for a pre-sending function. Note,
this information is also available with a crash report.

```typescript
export type Environment = {
  UtcOffset: number;
  Cpu?: string;
  Architecture?: string;
  ProcessorCount?: number;
  OSVersion?: string;
  OSSDKVersion?: string;
  WindowsBoundWidth?: number;
  WindowsBoundHeight?: number;
  CurrentOrientation?: string;
  ResolutionScale?: number;
  Locale?: string;
  TotalPhysicalMemory?: number;
  AvailablePhysicalMemory?: number;
  TotalVirtualMemory?: number;
  AvailableVirtualMemory?: number;
  DiskSpaceFree?: number;
  DeviceName?: string;
  KernelVersion?: string;
  Brand?: string;
  Board?: string;
  DeviceCode?: string;
  JailBroken?: boolean;
};
```

<br/>
<br/>

### LogLevel

The `LogLevel` enum is used to set the level for which the Raygun client will log issues during
runtime.

```typescript
export enum LogLevel {
  off = 'off',
  error = 'error',
  warn = 'warn',
  info = 'info',
  debug = 'debug',
  verbose = 'verbose',
}
```

<br/>
<br/>

### ManualCrashReportDetails

The `ManualCrashReportDetails` type is used to append additional, local details to a manually sent
crash report. Note, both fields are non-mandatory, therefore you can send just tags, or just custom
data. Note, ManualCrashReportDetails is a non-mandatory parameter for the `sendError` method. If no
local data is being appended to the error, you can avoid sending this object all together.

See also:<br/>
[sendError()](#senderrorerror-error-details-manualcrashreportdetails)

```typescript
export type ManualCrashReportDetails = {
  customData?: CustomData,
  tags?: string[]
}
```

<br/>
<br/>

### RaygunClientOptions

The `RaygunClientOptions` type is used to parse information into the RaygunClient during the `init`
function. Each field within the object is optional, however, failing to declare a field will result
in the option defaulting to its type specific default value (except for custom end points which will
default to the Raygun application end point). It is important that your `apiKey` is entered here,
else all crash reports and real user monitoring events will not be logged to your Raygun dashboard,
and will instead be thrown away, and lost forever.

See also:<br/>
[BeforeSendHandler](#beforesendhandler)

```typescript
export type RaygunClientOptions = {
  apiKey?: string;
  version?: string;
  enableCrashReporting?: boolean;
  disableNativeCrashReporting?: boolean;
  disableUnhandledPromiseRejectionReporting?: boolean;
  enableRealUserMonitoring?: boolean;
  disableNetworkMonitoring?: boolean;
  customCrashReportingEndpoint?: string;
  customRealUserMonitoringEndpoint?: string;
  logLevel?: LogLevel;
  onBeforeSendingCrashReport?: BeforeSendHandler;
  ignoredURLs?: string[];
  ignoredViews?: string[];
  maxErrorReportsStoredOnDevice?: number;
  maxBreadcrumbsPerErrorReport?: number;
};
```

<br/>
<br/>

### RaygunStackFrame

The `RaygunStackFrame` type is a container which maintains information found in one frame of a
StackTrace. The only access to a RaygunStackFrame is through the CrashReportPayload. This object
would only be used in a `BeforeSendHandler` function.

See also:<br/>
[BeforeSendHandler](#beforesendhandler) <br/>
[CrashReportPayload](#crashreportpayload)

```typescript
export type RaygunStackFrame = {
  FileName: string;
  LineNumber: number;
  ColumnNumber: number | null;
  MethodName: string;
  ClassName: string;
};
```

<br/>
<br/>

### RealUserMonitoringTimings

The `RealUserMonitoringTimings` enum is a parameter in the `sendRUMTimingEvent` method.

See also: <br/>
[sendRUMTimingEvent](#sendrumtimingeventeventtype-realusermonitoringtimings-name-string-timeusedinms-number)

```typescript
export enum RealUserMonitoringTimings {
  ViewLoaded = 'p',
  NetworkCall = 'n'
}
```

<br/>
<br/>

### User

The `User` type is used to record session data, and maintain information for Real User Monitoring.
This object type is used as a parameter for the `setUser` method, and is returned with the `getUser`
method. It is also found in other objects.

[Find out more here!](https://raygun.com/documentation/product-guides/real-user-monitoring/for-mobile/users/)

See also: <br/>
[setUser](#setuseruser-user--string)
[getUser](#getuser-user)

```typescript
export type User = {
  identifier: string;
  isAnonymous?: boolean;
  email?: string;
  firstName?: string;
  fullName?: string;
  uuid?: string;
};
```

<br/>
<br/>

## Native Crash Reporting

Raygun4ReactNative uses internally [Raygun4Android](https://github.com/MindscapeHQ/raygun4android/) 
and [Raygun4Apple](https://github.com/MindscapeHQ/raygun4apple) to capture errors on the platform framework layer.

These two platform providers are initialized by default when the Raygun4ReactNative provider is initalized.
To disable this, set `disableNativeCrashReporting` to `false` in the `RaygunClientOptions`.

> [!IMPORTANT]  
> Errors happening in the platform framework layer won't be captured by Raygun unless the provider has been initialized.

You can also initialize the platform providers directly by performing the setup steps documented in each respective provider project.
This ensures that the platform providers are initialized before the React Native application loads.

Setting `disableNativeCrashReporting` to `false` also disables all communication between Raygun4ReactNative and the platform providers,
therefore data like breadcrumbs or user information won't be accesible by the platform providers.

## Generating Sourcemaps

Source Maps help to convert minified JavaScript code back into source code. R
aygun uses them to take un-readable errors generated from minified JavaScript 
and translate them to be readable and to include code snippets from your source.

To generate them in your app, refer to the React Native documentation:
[Enabling sourcemaps for debuging release builds](https://reactnative.dev/docs/debugging-release-builds).

Once your sourcemaps have been generated,
follow the instructions in the [JavaScript Source Maps documentation](https://raygun.com/documentation/language-guides/javascript/crash-reporting/source-maps/)
to upload them.

---
