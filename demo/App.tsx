import * as React from 'react';
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from "./screens/Home";
import CrashReporting from "./screens/CrashReporting";
import RealUserMonitoring from "./screens/RealUserMonitoring";
import { raygunClient } from "./utils/Utils";
import { LogLevel, RaygunClientOptions } from "raygun4reactnative";


//#region -- REACT-NATIVE APPLICATION SETUP --------------------------------------------------------

/*//------------- Application testing setup -------------
//TODO: move to test initialization
const options: RaygunClientOptions = {
  apiKey: 'e5cxkTF9wHpIYxVaxvx6Ig',
  enableCrashReporting: true,
  enableRealUserMonitoring: true,
}
raygunClient.init(options);
//------------- End application testing setup -------------*/

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
          tabBarLabel: 'Home'
        }}
      />
      <Tab.Screen
        name="CrashReporting"
        component={CrashReporting}
        options={{
          tabBarLabel: 'Crash'
        }}
      />
      <Tab.Screen
        name="RealUserMonitoring"
        component={RealUserMonitoring}
        options={{
          tabBarLabel: 'RUM'
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tabs />
    </NavigationContainer>
  );
}

//#endregion ---------------------------------------------------------------------------------------
