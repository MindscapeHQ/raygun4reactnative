<p align="center">
    <a href="https://raygun.com/" target="_blank" align="center">
        <img src="https://brandfolder.com/raygun/logo/raygun-primary-logo.png" width="500">
    </a>
    <br/>
    <h1>Raygun SDK for React Native</h1>
</p>

## Requirements

```typescript
"react-native": ^0.60.0
```

## Installation and Usage

To install the package:

```shell script
npm install --save raygun4reactnative
# OR
yarn add raygun4reactnative
```

### Additional step - iOS

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

### Additional step - Android

#### **android/app/src/main/AndroidManifest.xml**

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

### How to use it:

```typescript
import RaygunClient from 'raygun4reactnative';

RaygunClient.init(raygunClientOtions);
```

The init function has one argument, RaygunClientOptions, which is constructed as follows:
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
};
```

#### In table form

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

Note: All parameters in the RaygunClientOptions are NOT required.
Any parameter that is not specified will be set to their default / empty values (based on their
type). Thus, you can initialize a client with the like the following example shows:

#### Examples

```typescript
// EXAMPLE
import RaygunClient from 'raygun4reactnative'

let options: RaygunClientOptions = {
apiKey: "abcd1234",
enableCrashReporting: true,
ignoredURLs: ["http://example.com"]
};

RaygunClient.init(options);
``` 

#### RaygunClientOptions explained:
