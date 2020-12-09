import {
  BreadcrumbOption,
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

/**
 * The RaygunClient is the interface in which this provider publicly shows. The bottom of this page
 * has an 'export' statement which exports the methods defined in the RaygunClient.ts file. Some
 * of the logical components have been separated out from this file and into classes specific to
 * CrashReporting or RealUserMonitoring (CrashReporter.ts and RealUserMonitor.ts respectively).
 */


//#region ----INITIALIZATION------------------------------------------------------------------------

const {RaygunNativeBridge} = NativeModules;


const getCleanSession = (): Session => ({
  tags: new Set(['React Native']),
  user: {
    identifier: `anonymous-${getDeviceBasedId()}`,
    isAnonymous: true
  }
});


let curSession = getCleanSession();
let crashReporter: CrashReporter;
let realUserMonitor: RealUserMonitor;
let options: RaygunClientOptions;
let initialised: boolean = false;

/**
 * RaygunClient initializer. Creates the CrashReporter and RealUserMonitor.
 * @param options
 */
const init = async (raygunclientOptions: RaygunClientOptions) => {
  options = clone(raygunclientOptions);

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
  } = options;

  if (initialised) {
    log('Already initialized');
    return false;
  }

  const nativeBridgeAvailable = RaygunNativeBridge && typeof RaygunNativeBridge.init === 'function';
  const crashReportingRequiresNative = enableCrashReporting && !disableNativeCrashReporting;

  //Initialise native if it is available and a service is utilising native side logic
  if (nativeBridgeAvailable && (crashReportingRequiresNative || enableRealUserMonitoring)) {
    await RaygunNativeBridge.init({
      apiKey,
      enableRealUserMonitoring,
      version,
      customCrashReportingEndpoint
    });
  }

  //enable CR
  if (enableCrashReporting) {
    crashReporter = new CrashReporter(curSession, apiKey, disableNativeCrashReporting, customCrashReportingEndpoint || '', onBeforeSendingCrashReport, version);
  }
  //Enable realUserMonitor
  if (enableRealUserMonitoring) {
    realUserMonitor = new RealUserMonitor(curSession, apiKey, disableNetworkMonitoring, ignoredURLs, customRealUserMonitoringEndpoint, version);
  }

  initialised = true;

  return true;
};

//#endregion----------------------------------------------------------------------------------------


//#region ----RAYGUN CLIENT SESSION LOGIC-----------------------------------------------------------

const addTag = (...tags: string[]) => {
  tags.forEach(tag => {
    curSession.tags.add(tag);
  });
  if (!options.disableNativeCrashReporting) {
    RaygunNativeBridge.setTags([...curSession.tags]);
  }
};

const setUser = (user: User | string) => {
  const userObj = Object.assign(
    {firstName: '', fullName: '', email: '', isAnonymous: true},
    typeof user === 'string' ?
      !!user ?
        {identifier: user, isAnonymous: true}
        : {identifier: `anonymous-${getDeviceBasedId()}`, isAnonymous: true}
      : user
  );
  curSession.user = userObj;
  if (!options.disableNativeCrashReporting) {
    RaygunNativeBridge.setUser(userObj);
  }
};

const clearSession = () => {
  curSession = getCleanSession();
  if (!options.disableNativeCrashReporting) {
    RaygunNativeBridge.clearSession();
  }

  crashReporter.resetCrashReporter();
};

//#endregion----------------------------------------------------------------------------------------


//#region ----CRASH REPORTING LOGIC-----------------------------------------------------------------

/**
 * Converts an incoming error and its stacktrace to a standard Raygun Crash Report format.
 * @param error
 * @param stackFrames
 */
const generateCrashReportPayload = (error: Error, stackFrames: StackFrame[]) => {
  if (CrashReportingUnavailable("generateCrashReportPayload")) return;
  crashReporter.generateCrashReportPayload(error, stackFrames).then();
};

/**
 * Create a breadcrumb in the current session.
 * @param message
 * @param details
 */
const recordBreadcrumb = (message: string, details?: BreadcrumbOption) => {
  if (CrashReportingUnavailable("recordBreadcrumb")) return;
  crashReporter.recordBreadcrumb(message, details);

};

const sendError = async (error: Error, ...params: any) => {
  if (CrashReportingUnavailable("sendError")) return;

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
  if (CrashReportingUnavailable("addCustomData")) return;
  crashReporter.addCustomData(customData);

}
const updateCustomData = (updater: (customData: CustomData) => CustomData) => {
  if (CrashReportingUnavailable("updateCustomData")) return;
  crashReporter.updateCustomData(updater);
}

/**
 * Checks whether or not the user has initialised the client AND enabled crash reporting.
 * @constructor
 */
const CrashReportingUnavailable = (calledFrom: string) => {
  if (!initialised) {
    warn(`Failed: "${calledFrom}" cannot be called before initialising RaygunClient. Please call RaygunClient.init(...) before trying to call RaygunClient.${calledFrom}(...)`);
    return true;
  } else if (!(crashReporter && options.enableCrashReporting)) {
    warn(`Failed: "${calledFrom}" cannot be called unless Crash Reporting has been enabled, please ensure that you set "enableCrashReporting" to true during RaygunClient.init(...)`);
    return true;
  }
  return false;
}

//#endregion----------------------------------------------------------------------------------------


//#region ----REAL USER MONITORING LOGIC------------------------------------------------------------

const sendRUMTimingEvent = (eventType: RealUserMonitoringEvents.ViewLoaded | RealUserMonitoringEvents.NetworkCall, name: string, timeUsedInMs: number) => {
  if (RealUserMonitoringUnavailable("sendRUMTimingEvent")) return;
  realUserMonitor.sendCustomRUMEvent(
    options.apiKey,
    eventType,
    name,
    timeUsedInMs,
    ''
  );
};

const RealUserMonitoringUnavailable = (calledFrom: string) => {
  if (!initialised) {
    warn(`Failed: "${calledFrom}" cannot be called before initialising RaygunClient. Please call RaygunClient.init(...) before trying to call RaygunClient.${calledFrom}(...)`);
    return true;
  }
  if (!(realUserMonitor && options.enableRealUserMonitoring)) {
    warn(`Failed: "${calledFrom}" cannot be called unless Real User Monitoring has been enabled, please ensure that you set "enableRealUserMonitoring" to true during RaygunClient.init(...)`);
    return true;
  }
  return false;
}

//#endregion----------------------------------------------------------------------------------------


export {
  init,
  addTag,
  setUser,
  clearSession,

  generateCrashReportPayload,
  recordBreadcrumb,
  addCustomData,
  sendError,
  updateCustomData,

  sendRUMTimingEvent
};
