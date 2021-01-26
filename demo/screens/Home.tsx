import {Button, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View} from "react-native";
import React, {useState} from "react";
import {raygunClient} from "../App";
import {styles} from "../utils/Utils";
import {Breadcrumb, User} from "raygun4reactnative";

export default function Home() {
  const [tagsBtn, setTagsBtn] = useState("Add Tags");
  const [userBtn, setUserBtn] = useState("Set User #1");
  const [breadcrumbsBtn, setBreadcrumbsBtn] = useState("Add Breadcrumb #1");

  /**
   * Example of: getTags()
   */
  const showTags = () => {
    // Get the tags the client currently has
    const clientTags = raygunClient.getTags();

    if (clientTags.length > 0) {
      return clientTags.map((tag) => {
        return (<Text key={`tag: ${tag}`} style={styles.text}>{tag}</Text>)
      })
    } else {
      return <Text style={styles.text} key={"NOTAGS"}>No Tags current are associated</Text>
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
   * Example of: getUser()
   */
  const showBreadcrumbs = () => {
    // Get the current user
    const clientBreadcrumbs: Breadcrumb[] = raygunClient.getBreadcrumbs();

    if (clientBreadcrumbs.length > 0) {
      console.log("HERE")
      return (clientBreadcrumbs.map((breadcrumb) => {
          return ([
              <Text key={`message${breadcrumb.timestamp}`}>Message: {breadcrumb.message}</Text>,
              <Text key={`category${breadcrumb.timestamp}`}>Category: {breadcrumb.category}</Text>,
              <Text key={`level${breadcrumb.timestamp}`}>Level: {breadcrumb.level}</Text>,
              <Text key={`time${breadcrumb.timestamp}`}>Time: {breadcrumb.timestamp}</Text>,
              <Text style={styles.secondView}/>]
          )
        })
      )
    } else {
      return <Text key={"NOBC"}>No Breadcrumbs current exist</Text>
    }
  }


  /**
   * Example of: setTags(...)
   */
  const setTags = () => {
    switch (tagsBtn) {
      case "Add Tags":
        raygunClient.setTags("iPhone 12", "iPhone 11");
        setTagsBtn("Add Different Tags");
        return;
      case "Add Different Tags":
        raygunClient.setTags("Samsung S21", "Google Pixel 4a");
        setTagsBtn("Remove All Tags");
        return;
      default:
        raygunClient.setTags();
        setTagsBtn("Add Tags")
    }
  }

  /**
   * Example of: setUser(...)
   */
  const setUser = () => {
    switch (userBtn) {
      case "Set User #1":
        const user1: User = {
          identifier: "Test_User_1",
          isAnonymous: false,
          firstName: "Ronald",
          fullName: "Ronald Raygun",
        }
        raygunClient.setUser(user1);
        setUserBtn("Set User #2")
        return;

      case "Set User #2":
        const user2: User = {
          identifier: "Test_User_2",
          isAnonymous: false,
          firstName: "Rachel",
          fullName: "Rachel Raygun",
        }
        raygunClient.setUser(user2);
        setUserBtn("Set User Anon")
        return;

      case "Set User Anon":
        const anon: User = {
          identifier: "",
          isAnonymous: true,
        }
        raygunClient.setUser(anon);
        setUserBtn("Set User #1")
        return;
    }
  }

  /**
   * Example of: addBreadcrumbs
   */
  const recordBreadcrumb = () => {
    switch (breadcrumbsBtn) {
      case "Add Breadcrumb #1":
        const bc1: Breadcrumb = {
          category: "Test",
          customData: undefined,
          level: "info",
          message: "Stage 1",
          timestamp: Date.now()
        }
        raygunClient.recordBreadcrumb(bc1);
        setBreadcrumbsBtn("Add Breadcrumb #2")
        return;
      case "Add Breadcrumb #2":
        const bc2: Breadcrumb = {
          category: "Test",
          customData: undefined,
          level: "info",
          message: "Stage 2",
          timestamp: Date.now()
        }
        raygunClient.recordBreadcrumb(bc2);
        setBreadcrumbsBtn("Clear Breadcrumbs")
        return;
      case "Clear Breadcrumbs":
        raygunClient.clearBreadcrumbs();
        setBreadcrumbsBtn("Add Breadcrumb #1")
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
              <Text style={styles.title}>Tags:</Text>
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
              <Text style={styles.title}>User:</Text>
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

          <View key={"BREADCRUMBS"} style={styles.mainView}>
            <View style={styles.secondView}>
              <Text style={styles.title}>Breadcrumbs:</Text>
              {showBreadcrumbs()}
            </View>

            <View style={styles.secondView}>
              <Button
                title={breadcrumbsBtn}
                color={"blue"}
                onPress={() => recordBreadcrumb()}
              />
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </>
  )
}