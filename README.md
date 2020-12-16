<p align="center">
    <a href="https://raygun.com/" target="_blank" align="center">
        <img src="https://brandfolder.com/raygun/logo/raygun-primary-logo.png" width="500">
    </a>
</p>

# Raygun SDK for React Native

---

# Table of contents
1. [Requirements](#requirements)
2. [Installations](#installation)
    - [Additional step for IOS](#additional-step-for-ios)
    - [Additional step for ANDROID](#additional-step-for-android)
3. [API guide](#api-guide)
    - [Important information](#important-information)
    - [Using the client](#using-the-client)
        - [Init](#initraygunclientoptions)
        - [AddTag](#addtag-tags-string)
        - [SetUser](#setuseruser-user--string)
        - [ClearSession](#clearsession)
        - [RecordBreadcrumb](#recordbreadcrumbmessage-string-details-breadcrumboption)
        - [SendError](#senderrorerror-error-params-any)
        - [AddCustomData](#addcustomdatacustomdata-customdata)
        - [UpdateCustomData](#updatecustomdataupdater-customdata-customdata--customdata)
        - [SendRumTimingEvent](#sendrumtimingeventeventtype-realusermonitoringtimings-name-string-timeusedinms-number)
    - [Raygun specific types](#raygun-specific-types)
        - [BeforeSendHandler](#beforesendhandler)
        - [Breadcrumb](#breadcrumb)
        - [BreadcrumbOption](#breadcrumboption)
        - [CrashReportPayload](#crashreportpayload)
        - [CustomData](#customdata)
        - [Environment](#environment)
        - [RaygunClientOptions](#raygunclientoptions)
        - [RaygunStackFrame](#raygunstackframe)
        - [RealUserMonitoringTimings](#realusermonitoringtimings)
        - [User](#user)
    
---

# Requirements

```json
{
"react-native": "^0.60.0"
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

###  Additional step for iOS 

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

###  Additional step for Android 

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

###  init(RaygunClientOptions) 
The `init` function must be used BEFORE doing anything else with the RaygunClient. This is important, as 
all other functionality within the client will rely on the options parsed to it with this function.

Multithreading: This function, by default, is NOT asynchronous. BEWARE, as asynchronously calling 
this method may lead to some undesirable outcomes. The `init` method needs to finish before all other
methods.


See also:<br/>
[BeforeSendHandler](#beforesendhandler)<br/>
[RaygunClientOptions](#raygunclientoptions)
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

<br/>
<br/>

###  addTag(... tags: string[]) 
The `addTag` function adds tags to all events sent to Raygun for both Crash Reporting and Real User Monitoring.
Within the Raygun application, you can use these tags to group particular errors together in a manner that aligns with what 
you want.

[Find out more here!](https://raygun.com/documentation/product-guides/crash-reporting/custom-data-tags/)
```typescript
import RaygunClient from "raygun4reactnative"

RaygunClient.addTag("Invalid_User_Entry", "Caught_Exception");
```

<br/>
<br/>

###  setUser(user: User | string) 
The `setUser` function is parsed a User object, or a string (used as an ID). Setting the user is an
important step in maintaining a session. By updating the User, the following rules are applied:
- anonymous_user -> user_1 => Current blank session is updated with the user data. 
- user_1 -> user_2 => Current session ends. A new session begins with user_2 information. 
- user_1 -> anonymous_user => Current sessions ends. A new blank session begins.
<br/>
  
[Find out more here!](https://raygun.com/documentation/product-guides/real-user-monitoring/for-mobile/users/)

See also:<br/>
[User](#user)
```typescript
import RaygunClient, {User} from "raygun4reactnative"

const user: User = {
    identifier: 'identifier',
    isAnonymous: false,
    email: 'user_by_object@email.com',
    firstName: 'first name',
    fullName: 'full name',
    uuid: 'uuid'
}

RaygunClient.setUser(user);

// Alternatively
RaygunClient.setUser("identifier");

// Reset to anonymous user
RaygunClient.setUser(null);
```

<br/>
<br/>

###  clearSession() 
Clears all information about the user and tags that have been set to this point.
```typescript
import RaygunClient from "raygun4reactnative"

RaygunClient.clearSession();
```

<br/>
<br/>

###  recordBreadcrumb(message: string, details?: BreadcrumbOption) 
Records Breadcrumbs that will be sent away with the CrashReportPayload.

See also:<br/>
[BreadcrumbOption](#breadcrumboption)
```typescript
import RaygunClient, {BreadcrumbOption} from "raygun4reactnative"

const bco: BreadcrumbOption = {
    category: 'Some String you choose',
    level: 'debug',
    customData: {"Key_6": "My Data is bland"},
}

RaygunClient.recordBreadcrumb("Some message", bco);
```

<br/>
<br/>

###  sendError(error: Error, ...params: any) 
Manually sends an error to Raygun. This method supports adding additional tags or custom data which 
will be appended to any other tags or custom data already provided.

See also:<br/>
[CustomData](#customdata)
```typescript
import RaygunClient, {CustomData} from "raygun4reactnative"

const error = new Error("Custom Message"); // This error can be any Error
const customData: CustomData = {"KEY_1": "VALUE_1"};

// Example 1 (with Custom Data, with Tags)
RaygunClient.sendError(error, customData, "tag1", "tag2", "tag3");

// Example 2 (with Custom Data, WITHOUT Tags)
RaygunClient.sendError(error, customData);

// Example 3 (WITHOUT Custom Data, with Tags)
RaygunClient.sendError(error, "tag1", "tag2", "tag3");
```

<br/>
<br/>

###  addCustomData(customData: CustomData) 
Appends custom data to the current set of custom data.

See also:<br/>
[CustomData](#customdata)
```typescript
import RaygunClient, {CustomData} from "raygun4reactnative"

const customData: CustomData = {"KEY_2": "VALUE_2"};

RaygunClient.addCustomData(customData);
```

<br/>
<br/>

###  updateCustomData(updater: (customData: CustomData) => CustomData) 
Apply some transformation lambda to all the custom data. The `updater` should be a function 
with one parameter (`CustomData` object). It should also return `CustomData`. This is similar to
the design of the `BeforeSendHandler` however, the `updater` shouldn't return `null`
<br/>
The updater footprint: `updater: (customData: CustomData) => CustomData`

See also:<br/>
[BeforeSendHandler](#beforesendhandler)
[CustomData](#customdata)
```typescript
import RaygunClient, {CustomData} from "raygun4reactnative"

const updater = (customData: CustomData) => {
  console.log(customData);
  return customData;
} 

RaygunClient.updateCustomData(updater);
```

<br/>
<br/>

###  sendRUMTimingEvent(eventType: RealUserMonitoringTimings, name: string, timeUsedInMs: number) 
Manually sends a new timing event to Real User Monitoring. Parsing in a RealUserMonitoringTiming event,
the name of the event, and the duration of the event.
 
See also:
[RealUserMonitoringTimings](#realusermonitoringtimings)
```typescript
import RaygunClient, {RealUserMonitoringTimings} from "raygun4reactnative"

RaygunClient.sendRUMTimingEvent(RealUserMonitoringTimings.ActivityLoaded, 'name of the event', 1000);
```
---

## Raygun specific types
This segment outlines the type declarations for some Raygun4ReactNative specific objects. Each of
these object types can be imported into your program and used (as the examples throughout the
rest of the API guide show).

<br/>


###  BeforeSendHandler 
The BeforeSendHandler acts as an intermediate function between your application and Raygun. This
function is parsed a CrashReportPayload and returns a CrashReportPayload or Null. 
Before the CrashReportPayload is sent to Raygun, this function will be called to interfere 
with the report. If `null` or other invalid object is returned, then the report is ignored 
(not sent to Raygun).

See also:<br/>
[CrashReportPayload](#crashreportpayload)
```typescript
export type BeforeSendHandler = (payload: CrashReportPayload) => CrashReportPayload | null;
```

<br/>
<br/>

###  Breadcrumb 
A Breadcrumb is a container for simple pieces of information that are used to aid with identifying
issues. These are sent away with a CrashReportPayload.

[Find out more here!](https://raygun.com/documentation/product-guides/crash-reporting/breadcrumbs/)

See also:<br/>
[CrashReportPayload](#crashreportpayload)
[CustomData](#customdata)
```typescript
export type Breadcrumb = {
  message: string;
  category?: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  customData?: CustomData;
  timestamp?: number;
};
```

<br/>
<br/>

###  BreadcrumbOption 
The BreadcrumbOption is similar to the Breadcrumb however it only has three fields.
`category`, `level`, and `customData` are the only fields used in this object type. This object
type is used as a parameter for `recoredBreadcrumb`

See also:<br/>
[Breadcrumb](#breadcrumb)
[CustomData](#customdata)
[recordBreadcrumb](#recordbreadcrumbmessage-string-details-breadcrumboption)
```typescript
export type BreadcrumbOption = Omit<Breadcrumb, 'message' | 'timestamp'>;
```

<br/>
<br/>

###  CrashReportPayload 
This object is only accessible within the [BeforeSendHandler](#beforesendhandler) function. 
This reference should aid in designing an intermediate function. It acts as a container for basic 
information about some crash.

See also:<br/>
[Breadcrumb](#breadcrumb)<br/>
[CustomData](#customdata)<br/>
[Environment](#environment)<br/>
[RaygunStackFrame](#raygunstackframe)

```typescript
export type CrashReportPayload = {
  OccurredOn: Date;
  Details: {
    Error: {
      ClassName: string;
      Message: string;
      StackTrace: RaygunStackFrame[]; // See more about RaygunStackFrames below
      StackString: string;
    };
    Environment: Environment;
    Client: {
      Name: string;
      Version: string;
    };
    UserCustomData: CustomData; // See more about Custom data below
    Tags?: string[];
    User?: User;
    Breadcrumbs?: Breadcrumb[]; // See more about Breadcrumbs above
    Version: string;
  };
};
```

<br/>
<br/>

###  CustomData 
CustomData is a type that can be nearly any object. As long as it applies to the following declaration
rules.
e.g. {"hello": "world"} is a perfectly valid CustomData object. 

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
The `Environment` type is accessible in a BeforeSendHandler function via the CrashReportPayload
parameter. It acts as a container for all variables related to the current system environment.
The structure below should aid if this information would be helpful for a pre-sending function.

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

###  RaygunClientOptions 
The RaygunClientOptions type is used to parse information into the RaygunClient during the `init`
function. Each field within the object is optional, however, failing to declare a field will result
in the option defaulting to its type specific default value (except for custom end points
which will default to the Raygun application end point). 

See also:<br/>
[BeforeSendHandler](#beforesendhandler)
```typescript
export type RaygunClientOptions = {
  apiKey?: string; // Found in the 'Application Settings' within the Raygun application.
  version?: string; // The version of YOUR application.
  enableCrashReporting?: boolean; // Enables the use of Crash Reporting.
  disableNativeCrashReporting?: boolean; // If Crash Reporting is enabled, this disables reporting on native crashes.
  enableRealUserMonitoring?: boolean; // Enables Real User Monitoring.
  disableNetworkMonitoring?: boolean; // If Real User Monitoring is enabled, this disables monitoring network usage.
  customCrashReportingEndpoint?: string; // Some alternate URL to send crash reports to.
  customRealUserMonitoringEndpoint?: string; // Some alternate URL to send real user monitoring data to.
  onBeforeSendingCrashReport?: BeforeSendHandler; // A BeforeSendHandler function (see below).
  ignoredURLs?: string[]; // An Array of URLs to ignore when network monitoring.
};
```

<br/>
<br/>

###  RaygunStackFrame 
The RaygunStackFrame is a container which maintains information found in one frame of a StackTrace.
The only access to a RaygunStackFrame is through the CrashReportPayload. 
This object would only be used in a BeforeSendHandler function.

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

###  RealUserMonitoringTimings 
Use this enum as a parameter in the sendRUMTimingEvent method.

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
  
###  User 
The Raygun `User` type is used to record session data, and maintain information for Real User Monitoring.
This object type is used as a parameter for the setUser method.

[Find out more here!](https://raygun.com/documentation/product-guides/real-user-monitoring/for-mobile/users/)

See also: <br/>
[setUser](#setuseruser-user--string)
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

---
