import {Button, Image, SafeAreaView, ScrollView, StatusBar, Text, View} from "react-native";
import React, {useState} from "react";
import {raygunClient, styles} from "../utils/Utils";
import {BeforeSendHandler, CrashReportPayload, LogLevel, RaygunClientOptions, User} from "raygun4reactnative";

//#region -- Initialization Object -----------------------------------------------------------------


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
const ignoredUrls: string[] = ["www.youtube.com"]

/**
 * This is an array of views that should be ignored. The name of the view is placed in the list, and or the
 * start of the name of many views is placed in the list.
 */
const ignoredViews: string[] = ["Test Ignored View"]

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
  ignoredViews: ignoredViews,
  logLevel: LogLevel.verbose,
  // Other settings to customize your Raygun usage
  // disableNativeCrashReporting: true,
  // disableUnhandledPromiseRejectionReporting: true,
  // disableNetworkMonitoring: true,
  // customCrashReportingEndpoint: "http://some-url-of-your-choice",
  // customRealUserMonitoringEndpoint: "http://some-url-of-your-choice"

}

//#endregion----------------------------------------------------------------------------------------

//#region -- User Objects --------------------------------------------------------------------------
/**
 * Note: The User type has been imported from the raygun4reactnative library. This is an outline
 * of the User object.
 */
const user1: User = {
  identifier: "Test_User_1",
  isAnonymous: false,
}

/**
 * Note: The User type has been imported from the raygun4reactnative library. This is an outline
 * of the User object.
 */
const user2: User = {
  identifier: "Test_User_2",
  isAnonymous: false,
  firstName: "Ruby",
  fullName: "Ruby Raygun",
}

//#endregion ---------------------------------------------------------------------------------------

export default function Home() {

  const [initBtn, setInitBtn] = useState("Initialize Client")
  const [initBtnColor, setInitBtnColor] = useState("green");
  const [tagsBtn, setTagsBtn] = useState("Set Tags #1");
  const [userBtn, setUserBtn] = useState("Set User #1");

  /**
   * IMPORTANT: Look in the '/utils/Utils.tsx' file to see how we made the RaygunClient object globally accessible.
   * Look above in the 'Initialization Objects' region for more details.
   * Usually this initialization would be done when the application is created (Top of App.tsx file). However, for
   * the purposes of this demo application, we have allowed for this interaction such that the user can see the logged
   * values if the client is not initialized. If you choose to initialize the client later during the runtime of your
   * application, you can see what will be printed to the console by clicking buttons in the application
   * BEFORE clicking the initialize button.
   */
  const initialize = () => {
    raygunClient.init(options);
    setInitBtn("Try Reinitialize")
    setInitBtnColor("red");
  }

  /**
   * Example of: getTags().
   */
  const showTags = () => {
    if (tagsBtn === "Set Tags #1") {
      return <Text key={"No Tags Text"} style={styles.text}>No Tags currently available</Text>
    }

    // Get the tags the client currently has
    const clientTags = raygunClient.getTags();

    if (clientTags.length > 0) {
      return clientTags.map((tag: string) => {
        return (<Text key={`Tag: ${tag}`} style={styles.text}>{tag}</Text>)
      })
    }
  }

  /**
   * Example of: getUser().
   */
  const showUser = () => {
    // Get the current user
    const clientUser = raygunClient.getUser();

    return [
      <Text key={"User ID"} style={styles.text}>Identifier: {clientUser.identifier}</Text>,
      <Text key={"User Anonymous"}
            style={styles.text}>Anonymous: {clientUser.isAnonymous ? "true" : "false"}</Text>
    ]
  }


  /**
   * Example of: setTags().
   */
  const setTags = () => {
    switch (tagsBtn) {
      case "Set Tags #1":
        raygunClient.setTags("iPhone 12", "iPhone 11");
        setTagsBtn("Set Tags #2");
        return;
      case "Set Tags #2":
        raygunClient.setTags("Samsung S21", "Google Pixel 4a");
        setTagsBtn("Remove All Tags");
        return;
      default:
        raygunClient.setTags();
        setTagsBtn("Set Tags #1")
    }
  }

  /**
   * Example of: setUser().
   */
  const setUser = () => {
    switch (userBtn) {
      case "Set User #1":
        raygunClient.setUser(user1);
        setUserBtn("Set User #2")
        return;

      case "Set User #2":
        raygunClient.setUser(user2);
        setUserBtn("Set User Anon")
        return;

      case "Set User Anon":
        raygunClient.setUser(null);
        setUserBtn("Set User #1")
        return;
    }
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
              <Text key={"Initialize Title"} style={styles.title}>Initialize:</Text>
              <Text key={"Initialization Explain"} style={styles.text}>If the RaygunClient is not initialize,
                then nothing will work. Before clicking this button, try clicking other buttons
                inside the application and watch what is printed to the console.</Text>
            </View>

            <View style={styles.secondView}>
              <Button
                title={initBtn}
                color={initBtnColor}
                onPress={() => initialize()}
              />
            </View>
          </View>

          <View style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"Set Tags Title"} style={styles.title}>Tags:</Text>
              {showTags()}
            </View>

            <View style={styles.secondView}>
              <Button
                title={tagsBtn}
                color={"blue"}
                onPress={() => setTags()}
              />
            </View>
          </View>

          <View style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"Set User Title"} style={styles.title}>User:</Text>
              {showUser()}
            </View>

            <View style={styles.secondView}>
              <Button
                title={userBtn}
                color={"blue"}
                onPress={() => setUser()}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  )
}
