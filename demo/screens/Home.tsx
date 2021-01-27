import {Button, SafeAreaView, ScrollView, StatusBar, Text, View} from "react-native";
import React, {useState} from "react";
import {raygunClient} from "../App";
import {styles} from "../utils/Utils";
import {User} from "raygun4reactnative";


//#region -- User Objects --------------------------------------------------------------------------

const user1: User = {
  identifier: "Test_User_1",
  isAnonymous: false,
  firstName: "Ronald",
  fullName: "Ronald Raygun",
}

const user2: User = {
  identifier: "Test_User_2",
  isAnonymous: false,
  firstName: "Ruby",
  fullName: "Ruby Raygun",
}

//#endregion ---------------------------------------------------------------------------------------

export default function Home() {

  const [tagsBtn, setTagsBtn] = useState("Set Tags #1");
  const [userBtn, setUserBtn] = useState("Set User #1");

  /**
   * Example of: getTags()
   */
  const showTags = () => {
    // Get the tags the client currently has
    const clientTags = raygunClient.getTags();

    if (clientTags.length > 0) {
      return clientTags.map((tag: string) => {
        return (<Text key={`tag: ${tag}`} style={styles.text}>{tag}</Text>)
      })
    } else {
      return <Text key={"NOTAGS"} style={styles.text}>No Tags currently available</Text>
    }
  }

  /**
   * Example of: getUser()
   */
  const showUser = () => {
    // Get the current user
    const clientUser = raygunClient.getUser();

    return [
      <Text key={"user_id"} style={styles.text}>Identifier: {clientUser.identifier}</Text>,
      <Text key={"user_anon"}
            style={styles.text}>Anonymous: {clientUser.isAnonymous ? "true" : "false"}</Text>
    ]
  }


  /**
   * Example of: setTags(...)
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
   * Example of: setUser(...)
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

          <View key={"TAGS"} style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"Tags:"} style={styles.title}>Tags:</Text>
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

          <View key={"USER"} style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"User:"} style={styles.title}>User:</Text>
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
