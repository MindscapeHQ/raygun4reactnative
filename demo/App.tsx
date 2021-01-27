import * as React from 'react';
import {NavigationContainer} from "@react-navigation/native";
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import Home from "./screens/Home";
import CrashReporting from "./screens/CrashReporting";
import RealUserMonitoring from "./screens/RealUserMonitoring";


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
