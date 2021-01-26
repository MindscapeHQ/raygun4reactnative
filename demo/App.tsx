import * as React from 'react';
import {NavigationContainer} from "@react-navigation/native";
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import Home from "./screens/Home";
import CrashReporting from "./screens/CrashReporting";
import RealUserMonitoring from "./screens/RealUserMonitoring";
import RaygunClient, {
  BeforeSendHandler,
  CrashReportPayload,
  RaygunClientOptions
} from "raygun4reactnative"

export const raygunClient = RaygunClient;

/**
 * This is an example of a BeforeSendHandler. This function is parsed through the RaygunClientOptions
 * and is called before sending any crash report. If the return value is null, then the crash report is
 * not sent. Avoid using any values that are outside the function. If you do need to use something
 * out of the scope of the function, ensure that it has been bound to the object it comes from.
 *
 * A BeforeSendHandler will take a CrashReportPayload and return a CrashReport payload. You're able
 * to import the CrashReportPayload type, as such, you're able to return any CrashReport that you
 * see fit.
 *
 * @param crp - The CrashReportPayload that is about to be sent.
 */
const beforeSendFunc: BeforeSendHandler = (crp: CrashReportPayload) => {
  if (crp.Details.Tags?.includes("ignore")) {
    return null;
  }
  return crp;
}

/**
 * This is an array of urls that should be ignored when network monitoring. Like the BeforeSendHandler,
 * this is parsed through the RaygunClientOptions and is used to block network monitoring events
 * from being sent to Raygun.com.
 */
const ignoredUrls: string[] = ["https://www.google.com/", "https://www.youtube.com/"]

/**
 * This is an example of a RaygunClientOptions type. This object defines the non-varying conditions
 * of your Raygun application. This object is parsed into the RaygunClient via the init method.
 * There are no mandatory fields in this object, but be aware, that any variable that is not defined
 * is set to a default value. If you don't have an apiKey value, then all the information sent to
 * Raygun.com will be ignored.
 */
const options: RaygunClientOptions = {
  apiKey: '',// Your API key
  version: '', // Your application version
  enableCrashReporting: true,
  enableRealUserMonitoring: true,
  onBeforeSendingCrashReport: beforeSendFunc,
  ignoredURLs: ignoredUrls,
  // Other settings to customize your Raygun usage
  disableNativeCrashReporting: true,
  disableNetworkMonitoring: true,
  customCrashReportingEndpoint: "http://some-url-of-your-choice",
  customRealUserMonitoringEndpoint: "http://some-url-of-your-choice"

}

/**
 * The RaygunClient.init method can be called at any place in the program. It's advisable that it is
 * initialized as soon as possible. Any calls on the RaygunClient before calling the init method
 * will be ignored.
 */
RaygunClient.init(options);

//#region -- REACT-NATIVE APPLICATION SETUP --------------------------------------------------------

const Tab = createBottomTabNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
    >
      <Tab.Screen
        name="Home"
        component={Home}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({color, size}) => (
            <MaterialCommunityIcons name="home" color={color} size={size}/>
          ),
        }}
      />
      <Tab.Screen
        name="CrashReporting"
        component={CrashReporting}
        options={{
          tabBarLabel: 'Crash',
          tabBarIcon: ({color, size}) => (
            <MaterialCommunityIcons name="flash-alert" color={color} size={size}/>
          ),
        }}
      />
      <Tab.Screen
        name="RealUserMonitoring"
        component={RealUserMonitoring}
        options={{
          tabBarLabel: 'RUM',
          tabBarIcon: ({color, size}) => (
            <MaterialCommunityIcons name="motion-sensor" color={color} size={size}/>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tabs/>
    </NavigationContainer>
  );
}

//#endregion ---------------------------------------------------------------------------------------