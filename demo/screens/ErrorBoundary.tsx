import React, {useState} from "react";
import {Button, SafeAreaView, ScrollView, Text, View} from "react-native";
import {RaygunErrorBoundary} from "raygun4reactnative";
import {styles} from "../utils/Utils";

function Crasher() {
  const [shouldCrash, setShouldCrash] = useState(false);

  if (shouldCrash) {
    throw new Error("Test Error: render-time error from ErrorBoundary demo");
  }

  return (
    <Button
      title={"Trigger render error"}
      color={"red"}
      onPress={() => setShouldCrash(true)}
    />
  );
}

export default function ErrorBoundaryScreen() {
  return (
    <SafeAreaView>
      <ScrollView style={styles.scrollView}>
        <View style={styles.mainView}>
          <View style={styles.secondView}>
            <Text style={styles.title}>RaygunErrorBoundary</Text>
            <Text style={styles.subtitle}>
              Render-time errors thrown inside the boundary are reported to
              Raygun (with React `componentStack` as custom data) and the
              fallback UI is shown until reset.
            </Text>
          </View>

          <View style={styles.secondView}>
            <RaygunErrorBoundary
              tags={["demo:error-boundary"]}
              customData={{screen: "ErrorBoundary"}}
              onError={(error) => {
                console.log("[ErrorBoundary] caught:", error.message);
              }}
              fallback={({error, reset}) => (
                <View style={{alignItems: "center"}}>
                  <Text style={styles.subtitle}>
                    Caught: {error.message}
                  </Text>
                  <Button title={"Reset"} color={"green"} onPress={reset} />
                </View>
              )}
            >
              <Crasher />
            </RaygunErrorBoundary>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
