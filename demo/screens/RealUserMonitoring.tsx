import React from "react";
import {Image, SafeAreaView, ScrollView, StatusBar, Text, View} from "react-native";
import {styles} from "../utils/Utils";

export default function RealUserMonitoring() {
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
        </ScrollView>
      </SafeAreaView>
    </>
  )
}