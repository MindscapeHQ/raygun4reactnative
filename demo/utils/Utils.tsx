import {StyleSheet} from "react-native";


export const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: "white"
  },
  mainView: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "10%",
    marginBottom: "10%",
  },
  secondView: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: '100%',
    marginBottom: "5%",
  },
  title: {
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
    fontSize: 16
  }
});
