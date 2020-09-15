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
} from 'react-native';

import {
  throwUndefinedError,
  throwCustomError,
  promiseRejection,
  reInitialize,
  makeNetworkCall,
} from './helper';

import {Header, Colors} from 'react-native/Libraries/NewAppScreen';

declare const global: {HermesInternal: null | {}};

import RaygunClient from '@sundayempire/raygun4reactnative';
// import {CrashReportPayload} from '@sundayempire/raygun4reactnative/dist/types';
RaygunClient.init({
  apiKey: 't2IwCSF44QbvhJLwDKL7Kw',
  version: 'version',
  enableNativeCrashReporting: true,
  enableRUM: true,
  // onBeforeSend: (report: CrashReportPayload): boolean => {
  //   if (report) {
  //     console.log('Before send callback, error report:', report);
  //   }
  //   return true;
  // },
});

const App = () => {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scrollView}>
          <Header />

          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-around',
              margin: 20,
              height: '100%',
            }}>
            <View
              style={{
                width: '45%',
                backgroundColor: 'skyblue',
                marginBottom: 15,
              }}>
              <Button
                testID="triggerUndefinedErrorBtn"
                accessibilityLabel="triggerUndefinedErrorBtn"
                onPress={() => throwUndefinedError()}
                title="Trigger undefined error"
              />
            </View>
            <View
              style={{
                width: '45%',
                backgroundColor: 'skyblue',
                marginBottom: 15,
              }}>
              <Button
                testID="triggerCustomErrorBtn"
                accessibilityLabel="triggerCustomErrorBtn"
                onPress={() => throwCustomError('Custom Error Message')}
                title="Trigger custom error"
              />
            </View>
            <View
              style={{
                width: '45%',
                backgroundColor: 'skyblue',
                marginBottom: 15,
              }}>
              <Button
                testID="triggerPromiseRejectionBtn"
                accessibilityLabel="triggerPromiseRejectionBtn"
                onPress={() => promiseRejection()}
                title="Trigger Promise rejection"
              />
            </View>
            <View
              style={{
                width: '45%',

                marginBottom: 15,
              }}>
              <Button
                color="green"
                testID="addTagsBtn"
                accessibilityLabel="addTagsBtn"
                onPress={() =>
                  RaygunClient.addTag(`${new Date().toISOString()}`)
                }
                title="Add DateString as Tags"
              />
            </View>
            <View
              style={{
                width: '45%',
                marginBottom: 15,
              }}>
              <Button
                color="green"
                testID="setUserByIdentifierBtn"
                accessibilityLabel="setUserByIdentifierBtn"
                onPress={() => RaygunClient.setUser('user@email.com')}
                title="Set User By Identifier"
              />
            </View>
            <View
              style={{
                width: '45%',
                marginBottom: 15,
              }}>
              <Button
                color="green"
                testID="setUserBtn"
                accessibilityLabel="setUserBtn"
                onPress={() =>
                  RaygunClient.setUser({
                    identifier: 'identifier',
                    isAnonymous: false,
                    email: 'user@email.com',
                    firstName: 'first name',
                    fullName: 'full name',
                    uuid: 'uuid',
                  })
                }
                title="Set User Object"
              />
            </View>
            <View
              style={{
                width: '45%',
                marginBottom: 15,
              }}>
              <Button
                color="green"
                testID="replaceCustomDataBtn"
                accessibilityLabel="replaceCustomDataBtn"
                onPress={() =>
                  RaygunClient.updateCustomData((data) => {
                    console.log('Existing customData', data);
                    return {
                      replaceAllData: true,
                    };
                  })
                }
                title="Replace Custom Data"
              />
            </View>
            <View
              style={{
                width: '45%',
                marginBottom: 15,
              }}>
              <Button
                color="green"
                testID="addCustomDataBtn"
                accessibilityLabel="addCustomDataBtn"
                onPress={() =>
                  RaygunClient.addCustomData({
                    [Date.now()]: `Random: ${Math.random() * 1000}`,
                  })
                }
                title="Add Random Custom Data"
              />
            </View>
            <View
              style={{
                width: '45%',
                marginBottom: 15,
              }}>
              <Button
                color="green"
                testID="addBreadcrumbBtn"
                accessibilityLabel="addBreadcrumbBtn"
                onPress={() =>
                  RaygunClient.recordBreadcrumb('Breadcrumb Message', {
                    category: 'Simulation',
                    level: 'debug',
                  })
                }
                title="Add Simple Breadcrumbs Data"
              />
            </View>
            <View
              style={{
                width: '45%',

                marginBottom: 15,
              }}>
              <Button
                color="green"
                testID="reInitializeBtn"
                accessibilityLabel="reInitializeBtn"
                onPress={() => reInitialize()}
                title="Trigger re-initialize native side"
              />
            </View>
            <View
              style={{
                width: '45%',

                marginBottom: 15,
              }}>
              <Button
                color="green"
                testID="makeNetworkCallBtn"
                accessibilityLabel="makeNetworkCallBtn"
                onPress={() => makeNetworkCall()}
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
    backgroundColor: Colors.lighter,
  },
  engine: {
    position: 'absolute',
    right: 0,
  },
  body: {
    backgroundColor: Colors.white,
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.black,
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.dark,
  },
  highlight: {
    fontWeight: '700',
  },
  footer: {
    color: Colors.dark,
    fontSize: 12,
    fontWeight: '600',
    padding: 4,
    paddingRight: 12,
    textAlign: 'right',
  },
});

export default App;
