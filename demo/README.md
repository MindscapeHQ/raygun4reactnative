# Raygun4ReactNative Demo Application

## 1) Setup:
Start by downloading the Raygun4ReactNative repository into Webstorm or IDE of choice. </br> 
### - Setting up device
To run the demo application, you need to implement some method of running a React-Naitve application.
This can be done through your phone, or a simulator

### 1.1) Device - iOS + Android
Go to this [link](https://reactnative.dev/docs/running-on-device) and follow the instructions.
Then skip to step 2.

### 1.2) Simulation - Windows + Linux
For Windows and Linux users, you can run a simulated Android device through 
[**'Android Studio'**](https://developer.android.com/studio). You will need to [set up a virtual 
device](https://developer.android.com/studio/run/managing-avds).

### 1.3) Simulation - MacOS
MacOS user will need to ensure Xcode is downloaded and setup, follow the first two steps ("Download + Setup" and 
"install Node, Watchman and Expo") in this
[guide](https://medium.com/dev-genius/creating-apps-in-react-native-with-an-ios-simulator-39bab189bbee).


## 2) Run:
The base folder is split into two different sections, the **'demo'** and **'sdk'**. In the demo project, 
there is a **'package.json'** file. Inside that file is a script that you can run call **'run_demo'**.</br>
</br>
_**raygun4reactnative -> demo -> package.json -> scripts: run_demo**_
</br>
</br>
This script has been implemented to clean up the repo, install dependencies, and run the application.
All of these steps can be done manually, however we highly suggest running this script. The script can
also be run from the terminal. 
</br>
To run the **'run_demo'** script from the terminal, change directory such that your terminal is in the
demo folder. Then run the script as seen below:
```text
.../raygun4reactnative: cd demo
.../raygun4reactnative/demo: npm run run_demo
```