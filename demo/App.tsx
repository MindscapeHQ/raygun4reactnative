/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */

import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  StatusBar,
  Button,
  NativeModules
} from 'react-native';

import {Colors, Header} from 'react-native/Libraries/NewAppScreen';
import RaygunClient, {
  Breadcrumb,
  CustomData,
  RaygunClientOptions,
  RealUserMonitoringTimings,
  User
} from 'raygun4reactnative';

declare const global: { HermesInternal: null | {} };

const {RaygunDemoBridge} = NativeModules;

const options: RaygunClientOptions = {
  apiKey:'', // YOUR APIKEY
  version: '0.0.2', // YOUR APP VERSION
  enableCrashReporting: true,
  enableRealUserMonitoring: true,
}

RaygunClient.init(options);

const App = () => {
  return (
    <>
      <StatusBar barStyle="dark-content"/>
      <SafeAreaView>
        <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scrollView}>
          <Header/>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-around',
              margin: 20,
              height: '100%'
            }}>
            <View
              style={{
                width: '45%',
                marginBottom: 15
              }}>
              <Button
                color="red"
                testID="runNativeError"
                accessibilityLabel="runNativeError"
                onPress={() => RaygunDemoBridge.runNativeError()}
                title="Run Native Error"
              />
            </View>

            <View
              style={{
                width: '45%',
                backgroundColor: 'orange',
                marginBottom: 15
              }}>
              <Button
                testID="triggerUndefinedErrorBtn"
                accessibilityLabel="triggerUndefinedErrorBtn"
                onPress={() => {
                  throw new Error("Test Error: Uncaught error");
                }}
                title="Trigger Uncaught Error"
              />
            </View>
              <View
                  style={{
                      width: '45%',
                      backgroundColor: 'yellow',
                      marginBottom: 15
                  }}>
                  <Button
                      testID="triggerUndefinedErrorBtn"
                      accessibilityLabel="triggerUndefinedErrorBtn"
                      onPress={() => {
                          //@ts-ignore
                          RaygunClient.sendRUMTimingEvent(RealUserMonitoringTimings.ViewLoaded, "TestEvent", 200)
                      }}
                      title="SEND CUSTOM RUM TIMING EVENT"
                  />
              </View>
            <View
              style={{
                width: '45%',
                backgroundColor: 'yellow',
                marginBottom: 15
              }}>
              <Button
                testID="triggerCustomErrorBtn"
                accessibilityLabel="triggerCustomErrorBtn"
                onPress={() => {
                  // Current user of the application
                  const user = "Guest"

                  // You caught some error, and now you can send it away
                  const customData: CustomData = {"Who's to blame: ": user}

                  // Send the error away with custom data
                  RaygunClient.sendError(new Error("Test Error: Custom Error"),  customData, "Error", "Caught", "Test");

                  // Here are three other means of sending an error, the custom data and tags placed in this method are local
                  // to the error. If you want to use the custom data and tags for other errors and rum events,
                  // set them using the RaygunClient.setCustomData or RaygunClient.setTags methods
                  // RaygunClient.sendError(new Error("Test Error: Custom Error"));
                  // RaygunClient.sendError(new Error("Test Error: Custom Error (Custom Data)"),  customData);
                  // RaygunClient.sendError(new Error("Test Error: Custom Error (Tags)"), "Error", "Caught", "Test");
                }}
                title="Trigger Customize Error"
              />
            </View>

            <View
              style={{
                width: '45%',
                backgroundColor: 'yellow',
                marginBottom: 15
              }}>
              <Button
                testID="triggerPromiseRejectionBtn"
                accessibilityLabel="triggerPromiseRejectionBtn"
                onPress={() => {
                  Promise.reject(new Error("Test Error: Promise Rejection"))
                }}
                title="Trigger Promise rejection"
              />
            </View>

            <View
              style={{
                width: '45%',
                marginBottom: 15
              }}>
              <Button
                color="green"
                testID="addTagsBtn"
                accessibilityLabel="addTagsBtn"
                onPress={() => RaygunClient.setTags("Testing_1", "Testing_2", "Testing_3")}
                title="Set Testing Tags"
              />
            </View>

            <View
              style={{
                width: '45%',
                marginBottom: 15
              }}>
              <Button
                color="green"
                testID="setUserBtn"
                accessibilityLabel="setUserBtn"
                onPress={() => {
                  const user: User = {
                    identifier: 'identifier',
                    isAnonymous: false,
                    email: 'user_by_object@email.com',
                    firstName: 'first name',
                    fullName: 'full name',
                    uuid: 'uuid'
                  }
                  RaygunClient.setUser(user);
                }
                }
                title="Set User Object"
              />
            </View>

            <View
              style={{
                width: '45%',
                marginBottom: 15
              }}>
              <Button
                color="green"
                testID="addCustomDataBtn"
                accessibilityLabel="addCustomDataBtn"
                onPress={() => {
                  const customData1: CustomData = {"Key_1": "Value"};
                  RaygunClient.setCustomData(customData1);
                }
                }
                title="Add Custom Data"
              />
            </View>

            <View
              style={{
                width: '45%',
                marginBottom: 15
              }}>
              <Button
                color="green"
                testID="addBreadcrumbBtn"
                accessibilityLabel="addBreadcrumbBtn"
                onPress={() => {
                  const bc: Breadcrumb = {
                    message: "Testing",
                    timestamp: Date.now(),
                    category: 'Some String you choose',
                    level: 'debug',
                    customData: {"Key_2": "My Data is bland"}
                  }
                  RaygunClient.recordBreadcrumb(bc)
                }
                }
                title="Add Simple Breadcrumbs Data"
              />
            </View>

            <View
              style={{
                width: '45%',
                marginBottom: 15
              }}>
              <Button
                color="green"
                testID="reInitializeBtn"
                accessibilityLabel="reInitializeBtn"
                onPress={() => {
                  const options: RaygunClientOptions = {
                    apiKey: 'notAValidKey',
                    version: '42',
                  };
                  RaygunClient.init(options);
                }}
                title="Trigger re-initialize native side"
              />
            </View>

            <View
              style={{
                width: '45%',
                marginBottom: 15
              }}>
              <Button
                color="green"
                testID="makeNetworkCallBtn"
                accessibilityLabel="makeNetworkCallBtn"
                onPress={() => {
                  fetch('https://www.google.com')
                  .then(({headers}) =>
                    console.log('Fetch call completed', headers.get('date')),
                  )
                  .catch(console.log);
                }}
                title="Make network call"
              />
            </View>

          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: Colors.lighter
  },
  engine: {
    position: 'absolute',
    right: 0
  },
  body: {
    backgroundColor: Colors.white
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.black
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.dark
  },
  highlight: {
    fontWeight: '700'
  },
  footer: {
    color: Colors.dark,
    fontSize: 12,
    fontWeight: '600',
    padding: 4,
    paddingRight: 12,
    textAlign: 'right'
  }
});

export default App;
