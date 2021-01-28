import {
  Button,
  NativeModules,
  ScrollView,
  Text,
  StatusBar,
  TextInput,
  View,
  SafeAreaView, Image
} from "react-native";
import React, {useState} from "react";
import {styles} from "../utils/Utils";
import {raygunClient} from "../utils/Utils";
import {Breadcrumb, CustomData, ManualCrashReportDetails} from "raygun4reactnative";
import CheckBox from "@react-native-community/checkbox";

const {RaygunDemoBridge} = NativeModules

//#region -- Breadcrumb Objects --------------------------------------------------------------------

/**
 * This is an example of a simplistic Breadcrumb. Using the bare minimum amount of fields.
 */
const bc1: Breadcrumb = {
  message: "Stage 1",
}

/**
 * This is an example of a complex Breadcrumb. Using ALL the fields available.
 */
const bc2: Breadcrumb = {
  category: "Test",
  customData: {"Test": "Custom Data for Breadcrumbs"},
  level: "info",
  message: "Stage 2",
  timestamp: new Date('December 17, 1995 03:24:00').valueOf()
}

//#endregion ---------------------------------------------------------------------------------------

//#region -- Custom Data Objects -------------------------------------------------------------------

/**
 * This is an example of a basic Custom Data object. Like most Javascript/Typescript objects, these objects are filled
 * with key: value pairs. This basic Custom Data object uses three different 'BasicType' values. number, string or boolean.
 */
const products: CustomData = {
  Object_1: 10,
  Object_2: "String",
  Object_3: true,
}

/**
 * This is an example of a complex Custom Data object. Like most Javascript/Typescript objects, these objects are filled
 * with key: value pairs. This complex Custom Data object uses three different types of 'values'. A Custom Data object
 * can also hold an array of BasicTypes (see above), another Custom Data object, or an array of Custom Data objects.
 */
const activeEmployees: any[] = ["Ronald", 10, "Ruby", true, "Raygun"];
const teamLead: CustomData = {
  name: "Raygun",
  age: 32,
  date: Date.now(),
}
const employee1: CustomData = {
  name: "Ronald",
  age: 27,
  date: Date.now(),
}
const employee2: CustomData = {
  name: "Ruby",
  age: 26,
  date: Date.now(),
}

/**
 * This is the Custom Data object we will be sending to Raygun.
 */
const sessionEmployees: CustomData = {
  active: activeEmployees,
  lead: teamLead,
  team: [employee1, employee2]
}

//#endregion ---------------------------------------------------------------------------------------

export default function CrashReporting() {
  const [isSelected, setSelection] = useState(false);
  const [numberOfCacheTens, setNumberOfCacheTens] = useState("1");
  const [numberOfCacheOnes, setNumberOfCacheOnes] = useState("0");
  const [updateBtn, setUpdateBtn] = useState("grey");
  const [breadcrumbsBtn, setBreadcrumbsBtn] = useState("Record Breadcrumb #1");
  const [customDataBtn, setCustomDataBtn] = useState("Set CustomData #1");


  /**
   * Example of: getBreadcrumbs().
   */
  const showBreadcrumbs = () => {
    // Get the current Breadcrumb
    const clientBreadcrumbs: Breadcrumb[] = raygunClient.getBreadcrumbs();

    if (clientBreadcrumbs.length > 0) {
      return (clientBreadcrumbs.map((breadcrumb) => {
          return ([
              <Text key={`message${breadcrumb.timestamp}`}
                    style={styles.text}>Message: {breadcrumb.message}</Text>,
              <Text key={`category${breadcrumb.timestamp}`}
                    style={styles.text}>Category: {breadcrumb.category}</Text>,
              <Text key={`level${breadcrumb.timestamp}`}
                    style={styles.text}>Level: {breadcrumb.level}</Text>,
              <Text key={`time${breadcrumb.timestamp}`}
                    style={styles.text}>Time: {breadcrumb.timestamp}</Text>,
              <Text key={"Gap"} style={{marginBottom: "5%"}}/>]
          )
        })
      )
    } else {
      return <Text key={"No Breadcrumbs"} style={styles.text}>No Breadcrumbs current exist</Text>
    }
  }


  /**
   * Example of: getCustomData().
   */
  const showCustomData = () => {
    const clientCustomData: CustomData | null | undefined = raygunClient.getCustomData();

    if (!clientCustomData) {
      return <Text key={"No CustomData"} style={styles.text}>No CustomData currently available</Text>
    }


    return Object.entries(clientCustomData).map((entry) => {
      const [first, second] = entry;
      const title: string = first.toString()
      let other: string = ""

      // This print statement is not generic to all custom object types.
      if (typeof second === "object") {
        if (Array.isArray(second)) {
          other = second.toLocaleString()
        } else if (second) {
          Object.entries(second).forEach((e) => {
            other += "\n\t" + e[0].toString() + ": " + e[1];
          })
        }
      }

      if (typeof second === 'number') {
        other = second.toString();
      }

      return <Text key={"Custom Data Information " + title} style={styles.text}>{title}: {other}</Text>
    })
  }

  /**
   * Example of: addBreadcrumbs().
   */
  const recordBreadcrumb = () => {
    switch (breadcrumbsBtn) {
      case "Record Breadcrumb #1":
        raygunClient.recordBreadcrumb(bc1);
        setBreadcrumbsBtn("Record Breadcrumb #2")
        return;
      case "Record Breadcrumb #2":
        raygunClient.recordBreadcrumb(bc2);
        setBreadcrumbsBtn("Clear Breadcrumbs")
        return;
      case "Clear Breadcrumbs":
        raygunClient.clearBreadcrumbs();
        setBreadcrumbsBtn("Record Breadcrumb #1")
        return;
    }
  }

  /**
   * Example of: setCustomData().
   */
  const setCustomData = () => {
    switch (customDataBtn) {
      case "Set CustomData #1":
        raygunClient.setCustomData(products);
        setCustomDataBtn("Set CustomData #2");
        return
      case "Set CustomData #2":
        raygunClient.setCustomData(sessionEmployees);
        setCustomDataBtn("Remove CustomData");
        return
      default:
        raygunClient.setCustomData(null);
        setCustomDataBtn("Set CustomData #1");
        return
    }
  }

  /**
   * Example of: An error being thrown
   */
  const throwError = () => {
    throw new Error("Test Error: Uncaught Error")
  }

  /**
   * Example of: Catching an error and sending it through to Raygun
   */
  const runCaughtError = () => {
    try {
      // Something that can throw an error occurs in here
      throw new Error("Test Error: Captured Error")
    } catch (e) {
      // After catching the error, send it to Raygun to log
      if (!isSelected) {
        // Simply send the error away, only attaching global variables
        raygunClient.sendError(e)
      } else {
        // LOCAL VARIABLES (these parameters will be local to this error only, along with all
        // currently existing global variables).
        const customData: CustomData = {"Local": "This is local custom data"};
        const tags: string[] = ["Local Tag 1", "Local Tag 2"];
        const mcr: ManualCrashReportDetails = {
          customData: customData, // Neither of these are mandatory.
          tags: tags
        }
        raygunClient.sendError(e, mcr);
      }
    }
  }


  /**
   * Example of: Catching an error and sending it through to Raygun, tagging with "ignore" such that the beforeSendHandler
   * that is setup (see Home.tsx) can catch the error and ignore it from being sent to Raygun.
   */
  const runCaughtAndIgnoredError = () => {
    try {
      // Something that can throw an error occurs in here
      throw new Error("Test Error: Captured Error")
    } catch (e) {
      // After catching the error, send it to Raygun to log
      if (!isSelected) {
        // Simply send the error away, only attaching global variables
        raygunClient.sendError(e)
      } else {
        const mcr: ManualCrashReportDetails = {
          tags: ["ignore"]
        }
        raygunClient.sendError(e, mcr);
      }
    }
  }

  /**
   * Example of: An uncaught promise rejection. These are not caught by the error catcher, however RaygunClient will
   * catch both error and promise rejections.
   */
  const throwPromiseRejection = () => {
    Promise.reject(new Error("Test Error: Promise Rejection"))
  }

  /**
   * Example of: Setting the maximum amount of errors stored on some device.
   */
  const updateMaxCachedErrors = () => {
    const tens = numberOfCacheTens.length === 0 ? 0 : Number(numberOfCacheTens);
    const ones = numberOfCacheOnes.length === 0 ? 0 : Number(numberOfCacheOnes);
    raygunClient.setMaxReportsStoredOnDevice((tens * 10) + ones);
    setUpdateBtn("grey");
  }

  /**
   * Updates the ten's value that is stored.
   * @param text - A digit value
   */
  const updateTensValue = (text: string) => {
    const newText = text.replace(numberOfCacheTens.toString(), "");
    if (isNaN(Number(newText))) return;
    setNumberOfCacheTens(newText)
    setUpdateBtn("green");
  }

  /**
   * Updates the one's value that is stored.
   * @param text - A digit value
   */
  const updateOnesValue = (text: string) => {
    const newText = text.replace(numberOfCacheOnes.toString(), "");
    if (isNaN(Number(newText))) return;
    setNumberOfCacheOnes(newText)
    setUpdateBtn("green");
  }

  return (
    <>
      <StatusBar barStyle="dark-content"/>
      <SafeAreaView>
        <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scrollView}>
          {/*Raygun Logo*/}
          <View key={"Raygun Logo"} style={styles.mainView}>
            <Image
              style={styles.image}
              source={require("../utils/Raygun_Logo.png")}/>
          </View>


          {/*Record Breadcrumbs section*/}
          <View style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"Breadcrumbs Title"} style={styles.title}>Breadcrumbs:</Text>
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

          {/*Update Custom Data section*/}
          <View style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"Custom Data Title"} style={styles.title}>Custom Data:</Text>
              {showCustomData()}
            </View>

            <View style={styles.secondView}>
              <Button
                title={customDataBtn}
                color={"blue"}
                onPress={() => setCustomData()}
              />
            </View>
          </View>

          {/*Throw Uncaught Error section*/}
          <View style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"Uncaught Error Title"} style={styles.title}>React Uncaught Error</Text>
            </View>
            <View style={styles.secondView}>
              <Button
                title={"Throw Uncaught Error"}
                color={"red"}
                onPress={() => {throwError()}}
              />
            </View>
          </View>

          {/*Throw Native Error Section*/}
          <View style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"Native Error Title"} style={styles.title}>Native Uncaught Error</Text>
            </View>

            <View style={styles.secondView}>
              <Button
                title={"Throw Native Error"}
                color={"red"}
                onPress={() => {RaygunDemoBridge.runNativeError()}}
              />
            </View>
          </View>

          {/*Throw Custom Error section*/}
          <View style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"Custom Error Title"} style={styles.title}>Caught Error</Text>

              <View style={{flexDirection: "row"}}>
                <Text key={"Custom Error Local Variables Question"} style={styles.subtitle}>Use local
                  variables?</Text>
                <CheckBox value={isSelected} onValueChange={setSelection}/>
              </View>
            </View>

            <View style={styles.secondView}>
              <Button
                title={"Send Custom Error"}
                color={"orange"}
                onPress={() => {runCaughtError()}}
              />
            </View>

            <View style={styles.secondView}>
              <Button
                  title={"Send Custom Ignored Error"}
                  color={"orange"}
                  onPress={() => {runCaughtAndIgnoredError()}}
              />
            </View>
          </View>

          {/*Throw Promise Rejection section*/}
          <View style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"Promise Rejection Title"} style={styles.title}>Promise Rejection</Text>
              <Button
                title={"Throw promise rejection"}
                color={"yellowgreen"}
                onPress={() => {throwPromiseRejection()}}/>
            </View>
          </View>

          {/*Set Max Cache Size section*/}
          <View style={styles.mainView}>
            <View style={styles.secondView}>
              <Text key={"Set Cache Size Title"} style={styles.title}>Set Max Cached Errors</Text>
              <View style={{flexDirection: "row"}}>
                <Text key={"Set Cache Size Question"} style={styles.subtitle}>Number of saved Crash Report?</Text>
                {/*TENS*/}
                <TextInput
                  style={styles.smallInput}
                  value={numberOfCacheTens.toString()}
                  onChangeText={(text) => {updateTensValue(text)}}
                  keyboardType={"number-pad"}
                />
                {/*ONES*/}
                <TextInput
                  style={styles.smallInput}
                  value={numberOfCacheOnes.toString()}
                  onChangeText={(text) => {updateOnesValue(text)}}
                  keyboardType={"number-pad"}
                />
              </View>

              <Button
                title={"Update"}
                color={updateBtn}
                onPress={() => {updateMaxCachedErrors()}}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  )
}
