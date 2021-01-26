import {StyleSheet} from "react-native";


export const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: "white"
  },
  mainView: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "20%",
    marginBottom: "20%",
  },
  secondView: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: '60%',
    marginBottom: "5%",
  },
  title: {
    fontWeight: "bold",
    fontSize: 30
  },
  subtitle: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 20
  },
  text: {
    fontSize: 16
  }
});