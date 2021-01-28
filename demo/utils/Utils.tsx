import {StyleSheet} from "react-native";
import RaygunClient, {
} from "raygun4reactnative"

export const raygunClient = RaygunClient;
export const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: "white"
  },
  mainView: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    marginTop: "10%",
    marginBottom: "10%",
  },
  secondView: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    width: '100%',
    marginBottom: "5%",
  },
  title: {
    alignContent:"center",
    fontWeight: "bold",
    fontSize: 30
  },
  subtitle: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 18,
    alignSelf: "flex-start",
    marginHorizontal: "5%"
  },
  text: {
    marginHorizontal: "5%",
    textAlign: "center",
    fontSize: 16
  },
  image: {
    width: "80%",
    alignSelf: "center",
    resizeMode: "contain",
  },
  smallInput: {
    fontWeight: "bold",
    textAlignVertical: "center",
    textAlign: "center",
    borderColor: 'gray',
    borderWidth: 1
  },
  largeInput: {
    width: "80%",
    fontWeight: "bold",
    textAlignVertical: "center",
    textAlign: "left",
    borderColor: 'gray',
    borderWidth: 1
  }
});
