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
