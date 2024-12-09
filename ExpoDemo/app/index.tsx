import { Button, Text, View } from "react-native";
import RaygunClient, { LogLevel, RaygunClientOptions } from "raygun4reactnative";

export default function Index() {

  const options: RaygunClientOptions = {
    apiKey: "INSERT_YOUR_API_KEY_HERE",
    version: "0.1.2",
    enableCrashReporting: true,
    logLevel: LogLevel.verbose,
  };
  
  RaygunClient.init(options);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Raygun Demo</Text>
      <Button title="Send Error" onPress={() => RaygunClient.sendError(Error("Error from Expo app"))} />
    </View>
  );
}
