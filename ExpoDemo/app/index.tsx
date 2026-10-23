import { useState } from "react";
import { Button, Text, View } from "react-native";
import RaygunClient, {
  LogLevel,
  RaygunClientOptions,
  RaygunErrorBoundary,
} from "raygun4reactnative";

const options: RaygunClientOptions = {
  apiKey: "INSERT_YOUR_API_KEY_HERE",
  version: "0.1.2",
  enableCrashReporting: true,
  enableRealUserMonitoring: true,
  logLevel: LogLevel.verbose,
};

RaygunClient.init(options);

function Crasher() {
  const [shouldCrash, setShouldCrash] = useState(false);

  if (shouldCrash) {
    throw new Error("Render-time error from Expo demo");
  }

  return (
    <Button
      title="Trigger render error"
      onPress={() => setShouldCrash(true)}
    />
  );
}

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
      }}
    >
      <Text>Raygun Demo</Text>
      <Button
        title="Send Error"
        onPress={() => RaygunClient.sendError(Error("Error from Expo app"))}
      />

      <Button
        title="Send fetch request"
        onPress={() => {
          fetch("https://www.example.com/expo-fetch?token=secret", { method: "post", body: "x" })
            .then((r) => console.log("fetch request finished with", r.status))
            .catch((e) => console.log("fetch request failed", String(e)));
        }}
      />

      <Button
        title="Send XHR request"
        onPress={() => {
          const xhr = new XMLHttpRequest();
          xhr.open("GET", "https://www.example.com/expo-xhr-test?token=secret#frag");
          xhr.onload = () => console.log("XHR request finished with", xhr.status);
          xhr.send();
        }}
      />

      <RaygunErrorBoundary
        tags={["demo:expo"]}
        fallback={({ error, reset }) => (
          <View style={{ alignItems: "center", gap: 8 }}>
            <Text>Caught by RaygunErrorBoundary:</Text>
            <Text>{error.message}</Text>
            <Button title="Reset" onPress={reset} />
          </View>
        )}
      >
        <Crasher />
      </RaygunErrorBoundary>
    </View>
  );
}
