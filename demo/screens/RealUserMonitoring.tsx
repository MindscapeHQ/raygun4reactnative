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
  const [networkBtnColor, setNetworkBtnColor] = useState("green");
  const [networkError, setNetworkError] = useState("");
  const [sendNetworkBtn, setSendNetworkBtn] = useState("Send Valid Request");
  // Login Variables
  const [username, setUsername] = useState("Username");
  const [loggedIn, setLoggedIn] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());


  /**
   * This is an example of your application sending network requests. There are two examples in this method, the first
   * is a network call that is not ignored by the RaygunClient (see Home.tsx). The second is a request that is ignored
   * by the RaygunClient.
   */
  const sendNetworkRequest = () => {
    switch (sendNetworkBtn) {
      case "Send Valid Request":
        fetch("https://www.google.com/").then(() => {
          setSendNetworkBtn("Send Ignored Request")
          setNetworkBtnColor("red")
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
          setNetworkBtnColor("green")
          setNetworkError("")
        }).catch(() => {
          setNetworkError("Unable to reach youtube.com. Check network connection")
          setSendNetworkBtn("Send Ignored Request")
        })
        setSendNetworkBtn("loading...");
        return;
    }
  }

  /**
   * This is an example of sending your own network event. The sendNetworkRequest() method above is the automated version
   * of sending a network request event to Raygun.com. However, if you have disabled network monitoring in your
   * RaygunClient.init method, then you can still record and send your own network event using this method.
   */
  const sendCustomNetworkEvent = () => {
    raygunClient.sendRUMTimingEvent(RealUserMonitoringTimings.NetworkCall, "Test Network Event", 100);
  }

  /**
   * This is an example of sending your own ViewLoaded event. The RaygunClient will automatically record the time it takes
   * to launch the application, however you may want to record times taken for other such events that occur in your app.
   * In this case, you can use the example below to do so.
   */
  const sendCustomViewEvent = () => {
    raygunClient.sendRUMTimingEvent(RealUserMonitoringTimings.ViewLoaded, "Test ViewLoaded Event", 200);
  }

  /**
   * This is an example of a login service. The demo app replicates the kind of events that may occur when a user is
   * logging in. NOTE: We have used alternative methods to simulate how certain events would react during this login
   * stage, the usage of the RaygunClient remains the same.
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
    }, 200)
  }

  /**
   * Adding to the login example, once the user has logged in, some event may occur. In this case we have displayed an
   * image to the screen (a very basic view event). This method will record the time between logging in to the time
   * the image is loaded, and then send the view event timing back to Raygun.
   */
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
          <View key={"Raygun Logo"} style={styles.mainView}>
            <Image
              style={styles.image}
              source={require("../utils/Raygun_Logo.png")}/>
          </View>

          <View style={styles.mainView}>

            <View style={styles.secondView}>
              <Text key={"Network Request Title"} style={styles.title}>Network Requests:</Text>
              <Text key={"Network Request Error"} style={styles.text}>{networkError}</Text>
            </View>

            <View style={styles.secondView}>
              <Button
                title={sendNetworkBtn}
                color={networkBtnColor}
                onPress={() => sendNetworkRequest()}/>
            </View>
          </View>

          <View style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"Custom Network Event"} style={styles.title}>Send Custom Network Event:</Text>
              <Text key={"Custom Network Event explain"} style={styles.text}>A custom network event is the
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

          <View style={styles.mainView}>

            <View style={styles.secondView}>
              <Text key={"Custom ViewLoaded Event"} style={styles.title}>Send Custom View Event:</Text>
              <Text key={"Custom ViewLoaded Event explain"} style={styles.text}>A view event is the time taken for
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

          <View style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"Login Title"} style={styles.title}>Login Example:</Text>
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
                source={require("../utils/Random_Image.png")}/>
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