<p align="center">
    <a href="https://raygun.com/" target="_blank" align="center">
        <img src="https://brandfolder.com/raygun/logo/raygun-primary-logo.png" width="500">
    </a>
    <br/>
    <h1>Raygun SDK for React Native</h1>
</p>

## Requirements

- `react-native >= 0.60.0`

## Installation and Usage

To install the package:

```sh
npm install --save @sundayempire/raygun4reactnative
# OR
yarn add @sundayempire/raygun4reactnative
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

```
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

```javascript
import RaygunClient from 'raygun4reactnative';

RaygunClient.init({
  //RaygunClientOptions
  apiKey: YOUR_RAYGUN_APIKEY,
  version: YOUR_APP_VERSION,
  enableNativeCrashReporting: true,
  enableRUM: true,
  onBeforeSend: null
});
```
