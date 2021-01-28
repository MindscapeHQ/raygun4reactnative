import React, {useState} from "react";
import {
  Button,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View
} from "react-native";
import {raygunClient, styles} from "../utils/Utils";
import {RealUserMonitoringTimings} from "raygun4reactnative";

export default function RealUserMonitoring() {
  // Send network component variables
  const [sendNetworkBtnColor, setSendNetworkBtnColor] = useState("green");
  const [networkError, setNetworkError] = useState("");
  const [sendNetworkBtn, setSendNetworkBtn] = useState("Send Valid Request");
  // Login Variables
  const [username, setUsername] = useState("Username");
  const [loggedIn, setLoggedIn] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());


  const sendNetworkRequest = () => {
    switch (sendNetworkBtn) {
      case "Send Valid Request":
        fetch("https://www.google.com/").then(() => {
          setSendNetworkBtn("Send Ignored Request")
          setSendNetworkBtnColor("red")
          setNetworkError("")
        }).catch(() => {
          setNetworkError("Unable to reach google.com. Check network connection")
          setSendNetworkBtn("Send Valid Request")
        })
        setSendNetworkBtn("loading...");
        return;
      case "Send Ignored Request":
        fetch("https://www.youtube.com/").then(() => {
          setSendNetworkBtn("Send Valid Request")
          setSendNetworkBtnColor("green")
          setNetworkError("")
        }).catch(() => {
          setNetworkError("Unable to reach youtube.com. Check network connection")
          setSendNetworkBtn("Send Ignored Request")
        })
        setSendNetworkBtn("loading...");
        return;
    }
  }

  const sendCustomNetworkEvent = () => {
    raygunClient.sendRUMTimingEvent(RealUserMonitoringTimings.NetworkCall, "Test Network Event", 100);
  }

  const sendCustomViewEvent = () => {
    raygunClient.sendRUMTimingEvent(RealUserMonitoringTimings.ViewLoaded, "Test ViewLoaded Event", 200);
  }

  /**
   * A more complex example of how to utilize RUM.
   */
  const login = () => {
    setLoggedIn(false)
    setStartTime(Date.now());
    if (username.length === 0) {
      setUsername('Test User Name');
    }

    // The setTimeout function acts like a network call to check the username against a database.
    setTimeout(() => {
      const timeElapsed = Date.now() - startTime;
      raygunClient.sendRUMTimingEvent(RealUserMonitoringTimings.NetworkCall, `Test Login: ${username}`, timeElapsed);
      setLoggedIn(true);
    }, 100)
  }

  const completedImageLoad = () => {
    const timeElapsed = Date.now() - startTime;
    raygunClient.sendRUMTimingEvent(RealUserMonitoringTimings.ViewLoaded, "Test Login", timeElapsed);
    setTimeout(() => setLoggedIn(false), 3000);
  }

  return (
    <>
      <StatusBar barStyle="dark-content"/>
      <SafeAreaView>
        <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scrollView}>
          <View key={"Image"} style={styles.mainView}>
            <Image
              style={styles.image}
              source={require("../utils/Raygun_Logo.png")}/>
          </View>

          <View key={"NETWORK"} style={styles.mainView}>

            <View style={styles.secondView}>
              <Text key={"Network Req"} style={styles.title}>Network Requests:</Text>
              <Text key={"Network err"} style={styles.text}>{networkError}</Text>
            </View>

            <View style={styles.secondView}>
              <Button
                title={sendNetworkBtn}
                color={sendNetworkBtnColor}
                onPress={() => sendNetworkRequest()}/>
            </View>
          </View>

          <View key={"CUSTOM NETWORK"} style={styles.mainView}>

            <View style={styles.secondView}>
              <Text key={"Cust Network Req"} style={styles.title}>Send Custom Network Event:</Text>
              <Text key={"Cust Network Explain"} style={styles.text}>A custom network event is the
                same as
                the automated version above. However, you may only want to monitor certain network
                calls. In this case, you will need to disable network monitoring in the Raygun.init
                method.
                Then you can capture, time and send the event to Raygun.</Text>
            </View>

            <View style={styles.secondView}>
              <Button
                title={"Send Custom Network Event"}
                color={"green"}
                onPress={() => sendCustomNetworkEvent()}/>
            </View>
          </View>

          <View key={"CUSTOM VIEW"} style={styles.mainView}>

            <View style={styles.secondView}>
              <Text key={"Cust View Req"} style={styles.title}>Send Custom View Event:</Text>
              <Text key={"Cust View Explain"} style={styles.text}>A view event is the time taken for
                some component to load. By default, Raygun will log how long it takes for your
                application
                to load. You may want to time some other events that occur in your application, such
                as
                page/screen load times. The ViewLoaded event should be used for these
                situations.</Text>
            </View>

            <View style={styles.secondView}>
              <Button
                title={"Send Custom View Event"}
                color={"green"}
                onPress={() => sendCustomViewEvent()}/>
            </View>
          </View>

          <View key={"LOGIN"} style={styles.mainView}>

            <View style={styles.secondView}>
              <Text key={"Login"} style={styles.title}>Login Example:</Text>
            </View>

            <View style={styles.secondView}>
              <TextInput
                style={styles.largeInput}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                }}
              />
            </View>

            <View style={styles.secondView}>
              <Button
                title={"Login"}
                color={"blue"}
                onPress={() => login()}/>
            </View>

            {loggedIn && (
              <Image
                style={styles.image}
                source={require("../utils/Logged_In.png")}/>
            )}

            {loggedIn && (
              completedImageLoad()
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  )
}