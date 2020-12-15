<p align="center">
    <a href="https://raygun.com/" target="_blank" align="center">
        <img src="https://brandfolder.com/raygun/logo/raygun-primary-logo.png" width="500">
    </a>
</p>

# Raygun SDK for React Native

---

# Table of Contents
1. [Requirements](#requirements)
2. [Installations](#installation)
    - [Additional Step for IOS](#additional-step-for-ios)
    - [Additional Step for ANDROID](#additional-step-for-android)
3. [API Guide](#api-guide)
    - [Important Information](#important-information)
    - [Raygun Specific Types](#raygun-specific-types)
        - [RaygunClientOptions](#raygunclientoptions)
        - [BeforeSendHandler](#beforesendhandler)
        - [Breadcrumb](#breadcrumb)
        - [BreadcrumbOption](#breadcrumboption)
        - [CrashReportPayload](#crashreportpayload)
        - [CustomData](#customdata)
        - [RaygunStackFrame](#raygunstackframe)
        - [RealUserMonitoringTimings](#realusermonitoringtimings)
        - [User](#user)
    - [Instantiating the client](#instantiating-the-client)
        - [Init](#initraygunclientoptions)
        - [AddTag](#addtag-tags-string)
        - [SetUser](#setuseruser-user--string)
        - [ClearSession](#clearsession)
        - [RecordBreadcrumb](#recordbreadcrumbmessage-string-details-breadcrumboption)
        - [SendError](#senderrorerror-error-params-any)
        - [AddCustomData](#addcustomdatacustomdata-customdata)
        - [UpdateCustomData](#updatecustomdataupdater-customdata-customdata--customdata)
        - [SendRumTimingEvent](#sendrumtimingeventeventtype-realusermonitoringtimings-name-string-timeusedinms-number)
    
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

<br/>

### <u> Additional Step for iOS </u>

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

### <u> Additional Step for Android </u>

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

## Important Information 
The client must be instantiated and initialized before using the rest of the API. Failing to do so
will result in a lack of functionality (this will be logged out to the system - this means that
during testing it will appear where console.logs appear).

## Raygun Specific Types
This segment outlines the type declarations for some Raygun4ReactNative specific objects. Each of
these object types can be imported into your program and used (as the examples throughout the
rest of the API guide show).

<br/>

### <u> RaygunClientOptions </u>
The RaygunClientOptions type gets used to parse information into the RaygunClient during the [init](#initraygunclientoptions)
function. Each field within the object is optional, however, failing to declare a field will result
in the option defaulting to its type specific default value (except for custom Endpoints
which will default to the Raygun application Endpoint). 

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

### <u> BeforeSendHandler </u>
The BeforeSendHandler acts as an intermediate function between your application and Raygun. This
function gets parsed a [CrashReportPayload](#crashreportpayload) and returns a [CrashReportPayload](#crashreportpayload). 
Before the [CrashReportPayload](#crashreportpayload) is sent to Raygun, this function will interfere 
with the report. If `null` is returned, then the report gets ignored (not sent to Raygun).
 
```typescript
export type BeforeSendHandler = (payload: CrashReportPayload) => CrashReportPayload | null;
```

<br/>
<br/>

### <u> Breadcrumb </u>
A Breadcrumb is a container for simple pieces of information that are used to aid with identifying
issues. These are sent away with a [CrashReportPayload](#crashreportpayload).

```typescript
export type Breadcrumb = {
  message: string;
  category?: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  customData?: CustomData; // See more on CustomData below
  timestamp?: number;
};
```

<br/>
<br/>

### <u> BreadcrumbOption </u>
The BreadcrumbOption is similar to the Breadcrumb (see above) however it only has three fields.
`category`, `level`, and `customData` are the only fields used in this object type. This object
type gets used as a parameter for [recordBreadcrumb](#rec)
```typescript
export type BreadcrumbOption = Omit<Breadcrumb, 'message' | 'timestamp'>;
```

<br/>
<br/>

### <u> CrashReportPayload </u>
This object is only accessible within the [BeforeSendHandler](#beforesendhandler) function. 
This reference should aid in designing an intermediate function. It acts as a container for basic 
information about some crash.

See Also:
    - [RaygunStackFrame](#raygunstackframe)
    - [CustomData](#customdata)
    - [Breadcrumb](#breadcrumb)

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

### <u> CustomData </u>
CustomData is a type that can be nearly any object. As long as it applies to the following declaration
rules.
e.g. {"hello": "world"} is a perfectly valid CustomData object. 

```typescript
export type CustomData = {
  [key: string]: BasicType | CustomData | BasicType[] | CustomData[];
};

// For Reference (this is not an avilable type in the API)
const BasicType = string | number | boolean;
```

<br/>
<br/>

### <u> RaygunStackFrame </u>
The RaygunStackFrame is a container which maintains information found in one frame of a StackTrace.
The only access to a RaygunStackFrame is through the [CrashReportPayload](#crashreportpayload). 
This object would only be used in a [BeforeSendHandler](#beforesendhandler) function.
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

### <u> RealUserMonitoringTimings </u>
Use this enum as a parameter in the [sendRUMTimingEvent](#sendrumtimingeventeventtype-realusermonitoringtimings-name-string-timeusedinms-number)
method.
```typescript
export enum RealUserMonitoringTimings {
  ViewLoaded = 'p',
  NetworkCall = 'n'
}
```

<br/>
<br/>
  
### <u> User </u>
The Raygun `User` type gets used to record session data, and maintain information for Real User Monitoring.
This object type gets used as a parameter for the [setUser](#setuseruser-user--string) method.
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

## Instantiating the client

An instance of the RaygunClient is created by importing the client from the package.

```typescript
import RaygunClient from "raygun4reactnative"
```
This instance will be used to call action upon the rest of the API interface. Be sure to `init` your
instance BEFORE using the other functions within the API.  

<br/>
<br/>

### <u> init(RaygunClientOptions) </u>
The `init` function must be used BEFORE doing anything else with the RaygunClient. This is important, as 
all other functionality within the client will rely on the options parsed to it with this function.

Multithreading: This function, by default, is NOT asynchronous. BEWARE, as asynchronously calling 
this method may lead to some undesirable outcomes. The `init` method needs to finish before all other
methods.

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

// HERE
RaygunClient.init(options);
```

After successfully calling the init function, the client has been instantiated and initialized. 
Now the other functions provided by the client will be able to run. 

<br/>
<br/>

### <u> addTag(... tags: string[]) </u>
The `addTag` function adds tags to the Crash Reports and Real User Monitor. Within the Raygun application, 
you can use these tags to group particular errors together in a manner that aligns with what 
you want.
```typescript
import RaygunClient from "raygun4reactnative"

RaygunClient.addTag("Invalid_User_Entry", "Caught_Exception");
```

<br/>
<br/>

### <u> setUser(user: User | string) </u>
The `setUser` function get parse a [User](#user) object, or a string (used as an ID). Updating the user
will aid in Real User and Network monitoring session data. To reset the user back to ANON, simply call
this method with `null` as the 'user' parameter.
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

// Reset to ANON user
RaygunClient.setUser(null);
```

<br/>
<br/>

### <u> clearSession() </u>
Clears all information about the user and tags that have been set to this point.
```typescript
import RaygunClient from "raygun4reactnative"

RaygunClient.clearSession();
```

<br/>
<br/>

### <u> recordBreadcrumb(message: string, details?: BreadcrumbOption) </u>
Records Breadcrumbs that will be sent away with the CrashReportPayload.
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

### <u> sendError(error: Error, ...params: any) </u>
Allows for an error to be sent to the Crash Reporting error handler along with some customized
data. 'params' can be configured in the following ways:
    1) data: CustomData, ... tags: string
    2) data: CustomData
    3) ... tags: string
If custom data is being parsed with this function, ensure it is placed first before any tags. Also
ensure that the custom data is a [CustomData](#customdata) instance, all tags will be strings.
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

### <u> addCustomData(customData: CustomData) </u>
Appends custom data to the current set of custom data.
```typescript
import RaygunClient, {CustomData} from "raygun4reactnative"

const customData: CustomData = {"KEY_2": "VALUE_2"};

RaygunClient.addCustomData(customData);
```

<br/>
<br/>

### <u> updateCustomData(updater: (customData: CustomData) => CustomData) </u>
Apply some transformation lambda to all the custom data.

```typescript
import RaygunClient, {CustomData} from "raygun4reactnative"

const updater = (customData: CustomData) => {
  console.log(customData);
  return customData;
} 

RaygunClient.addCustomData(updater);
```

<br/>
<br/>

### <u> sendRUMTimingEvent(eventType: RealUserMonitoringTimings, name: string, timeUsedInMs: number) </u>
Construct a Real User Monitoring Timing Event and send it to the Real User Monitor to be transmitted.

```typescript
import RaygunClient, {RealUserMonitoringTimings} from "raygun4reactnative"

RaygunClient.sendRUMTimingEvent(RealUserMonitoringTimings.ActivityLoaded, 'name of the event', 1000);
```
