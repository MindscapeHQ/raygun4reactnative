/**
 * The RaygunClient is responsible for managing the users access to Real User Monitoring and
 * Crash Reporting functionality as well as managing Session specific data.
 */

import {
  BreadcrumbOption, CrashReportPayload,
  CustomData,
  RaygunClientOptions,
  RealUserMonitoringEvents,
  Session,
  User
} from "./Types";
import {clone, getDeviceBasedId, log, warn} from './Utils';
import {NativeModules} from "react-native";
import CrashReporter from "./CrashReporter";
import RealUserMonitor from "./RealUserMonitor";
import {StackFrame} from "react-native/Libraries/Core/Devtools/parseErrorStack";
import runOnlyPendingTimers = jest.runOnlyPendingTimers;
const {RaygunNativeBridge} = NativeModules;


const getCleanSession = (): Session => ({
  tags: new Set(['React Native']),
  user: {
    identifier: `anonymous-${getDeviceBasedId()}`
  }
});

let curSession = getCleanSession();
let crashReporter: CrashReporter;
let realUserMonitor: RealUserMonitor;
let Options: RaygunClientOptions;
let initialized: boolean = false;

//Extract the users RaygunClientOptions and enable desired features.
const init = async (options: RaygunClientOptions) => {
  Options = clone(options);

  //Cleans options with defaults
  const {
    apiKey = '',
    version = '',
    enableCrashReporting = false,
    disableNativeCrashReporting = false,
    enableRealUserMonitoring = false,
    disableNetworkMonitoring = false,
    customCrashReportingEndpoint = '',
    customRealUserMonitoringEndpoint = '',
    onBeforeSendingCrashReport = null,
    ignoredURLs = []
  } = Options;

  //Check if native bridge is available and enabled by the user
  const useNativeCR = !disableNativeCrashReporting && RaygunNativeBridge && typeof RaygunNativeBridge.init === 'function';

  //Do not reinitialize
  if (initialized) {
    log('Already initialized');
    return false;
  }


  //initialize if a service is being utilised
  if (useNativeCR || enableRealUserMonitoring) {
    await RaygunNativeBridge.init({
      apiKey,
      enableRealUserMonitoring,
      version,
      customCrashReportingEndpoint
    });
  }

  //Enable Crash Reporting
  if (enableCrashReporting) {
    crashReporter = new CrashReporter(curSession, apiKey, disableNetworkMonitoring, customCrashReportingEndpoint || '', onBeforeSendingCrashReport, version);
  }
  //Enable Real User Monitoring
  if (enableRealUserMonitoring) {
    realUserMonitor = new RealUserMonitor(curSession, apiKey, disableNetworkMonitoring, ignoredURLs, customRealUserMonitoringEndpoint, version);
  }

  initialized = true;

  return true;
};



//-------------------------------------------------------------------------------------------------
// RAYGUN CLIENT SESSION LOGIC
//-------------------------------------------------------------------------------------------------

const addTag = (...tags: string[]) => {
  tags.forEach(tag => {
    curSession.tags.add(tag);
  });
  if (!Options.disableNativeCrashReporting) {
    RaygunNativeBridge.setTags([...curSession.tags]);
  }
};

const setUser = (user: User | string) => {

  //Discern the type of the user argument and apply it to the user field
  const userObj = Object.assign(
    {firstName: '', fullName: '', email: '', isAnonymous: false},
    typeof user === 'string' ?
      !!user ?
        {identifier: user}
        : {identifier: `anonymous-${getDeviceBasedId()}`, isAnonymous: true}
      : user
  );
  curSession.user = userObj;
  if (!Options.disableNativeCrashReporting) {
    RaygunNativeBridge.setUser(userObj);
  }
};

const clearSession = () => {
  curSession = getCleanSession();
  if (!Options.disableNativeCrashReporting) {
    RaygunNativeBridge.clearSession();
  }

  crashReporter.resetCrashReporter();
};



//-------------------------------------------------------------------------------------------------
// CRASH REPORTING LOGIC
//-------------------------------------------------------------------------------------------------

const recordBreadcrumb = (message: string, details?: BreadcrumbOption) => {
  if (!CrashReportingAvailable()) return;
  crashReporter.recordBreadcrumb(message, details);

};

const sendCustomError = async (error: Error, ...params: any) => {
  if (!CrashReportingAvailable()) return;

  const [customData, tags] = (params.length == 1 && Array.isArray(params[0])) ? [null, params[0]] : params;

  if (customData) {
    addCustomData(customData as CustomData);
  }
  if (tags && tags.length) {
    addTag(...tags as string[]);
  }

  await crashReporter.processUnhandledError(error);
};

const addCustomData = (customData: CustomData) => {
  if (!CrashReportingAvailable()) return;
  crashReporter.addCustomData(customData);

}

const updateCustomData = (updater: (customData: CustomData) => CustomData) => {
  if (!CrashReportingAvailable()) return;
  crashReporter.updateCustomData(updater);
}

const CrashReportingAvailable = () => {
  if (!initialized) {
    warn('RaygunClient has not been initialized, please call RaygunClient.init(...) before trying to use Raygun features');
    return false;
  } else if (!(crashReporter && Options.enableCrashReporting)) {
    warn('Crash Reporting not enabled, please that you set "enableCrashReporting" to true during RaygunClient.init()');
    return false;
  }
  return true;
}



//-------------------------------------------------------------------------------------------------
// REAL USER MONITORING LOGIC
//-------------------------------------------------------------------------------------------------

const sendRUMTimingEvent = (eventType: RealUserMonitoringEvents.ActivityLoaded | RealUserMonitoringEvents.NetworkCall, name: string, timeUsedInMs: number) => {
  if (!RealUserMonitoringAvailable()) return;
  realUserMonitor.sendCustomRUMEvent(
    eventType,
    name,
    timeUsedInMs
  );
};

const RealUserMonitoringAvailable = () => {
  if (!initialized) {
    warn('RaygunClient has not been initialized, please call RaygunClient.init(...) before trying to use Raygun features');
    return false;
  }
  if (!(realUserMonitor && Options.enableRealUserMonitoring)) {
    warn('Real User Monitoring not enabled, please that you set "enableRealUserMonitoring" to true during RaygunClient.init()');
    return false;
  }
  return true;
}



export {
  init,
  addTag,
  setUser,
  clearSession,

  sendCustomError,
  recordBreadcrumb,
  addCustomData,
  updateCustomData,

  sendRUMTimingEvent
};
