import {
  BreadcrumbOption,
  CustomData,
  RaygunClientOptions,
  RUMEvents,
  Session,
  User
} from "./Types";
import { getDeviceBasedId, log, warn } from './Utils';
import {NativeModules} from "react-native";
import CrashReporter from "./CrashReporter";
import RealUserMonitor from "./RealUserMonitor";
import {StackFrame} from "react-native/Libraries/Core/Devtools/parseErrorStack";
import {clone} from "./Helper";
import runOnlyPendingTimers = jest.runOnlyPendingTimers;
/**
 * The RaygunClient is the interface in which this provider publicly shows. The bottom of this page
 * has an 'export' statement which exports the methods defined in the RaygunClient.ts file. Some
 * of the logical components have been separated out from this file and into classes specific to
 * CrashReporting or RealUserMonitoring (CrashReporter.ts and RealUserMonitor.ts respectively).
 */
const {RaygunNativeBridge} = NativeModules;
/**
 *
 */
const getCleanSession = (): Session => ({
  tags: new Set(['React Native']),
  customData: {},
  breadcrumbs: [],
  user: {
    identifier: `anonymous-${getDeviceBasedId()}`
  }
});
const getCurrentUser = () => curSession.user;
let curSession = getCleanSession();
let cr: CrashReporter;
let rum: RealUserMonitor;
let Options : RaygunClientOptions;
/**
 * RaygunClient initializer. Creates the CrashReporter and RealUserMonitor.
 * @param options
 */
const init = async (options: RaygunClientOptions) => {
  Options = clone(options);
  //Cleans options with defaults
  let {
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
  //Check if native bridge is available and enabled
  let useNativeCR = !disableNativeCrashReporting && RaygunNativeBridge && typeof RaygunNativeBridge.init === 'function';
  //Has the client already been initialised
  let alreadyInitialized = useNativeCR && (await RaygunNativeBridge.hasInitialized());
  if (alreadyInitialized) {
    log('Already initialized');
    return false;
  }
  //Initialise if a service is being utilised
  if (useNativeCR || enableRealUserMonitoring) {
    RaygunNativeBridge.init({
      apiKey,
      enableRealUserMonitoring,
      version,
      customCrashReportingEndpoint
    });
  }
  //Enable rum
  if (enableRealUserMonitoring) {
    rum = new RealUserMonitor(getCurrentUser, apiKey, disableNetworkMonitoring, ignoredURLs, customRealUserMonitoringEndpoint, version);
  }
  //enable CR
  if (enableCrashReporting) {
    cr = new CrashReporter(curSession, apiKey, disableNetworkMonitoring, customCrashReportingEndpoint || '', onBeforeSendingCrashReport, version);
  }
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
  let userObj = Object.assign(
    { firstName: '', fullName: '', email: '', isAnonymous: false },
    typeof user === 'string' ?
      !!user ?
        {identifier: user}
        : {identifier: `anonymous-${getDeviceBasedId()}`,isAnonymous: true}
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
};
//-------------------------------------------------------------------------------------------------
// CRASH REPORTING LOGIC
//-------------------------------------------------------------------------------------------------
/**
 * Converts an incoming error and its stacktrace to a standard Raygun Crash Report format
 * @param error
 * @param stackFrames
 */
const generateCrashReportPayload = (error: Error, stackFrames: StackFrame[]) => {
  if (cr && Options.enableCrashReporting) {
    cr.generateCrashReportPayload(error, stackFrames).then();
  } else {
    warn('TODO');
    return;
  }
};
/**
 * Create a breadcrumb in the current session
 * @param message
 * @param details
 */
const recordBreadcrumb = (message: string, details?: BreadcrumbOption) => {
  if (cr && Options.enableCrashReporting) {
    cr.recordBreadcrumb(message, details);
  } else {
    warn('TODO');
    return;
  }
};
const sendCustomError = async (error: Error, ...params: any) => {
  if (cr && Options.enableCrashReporting) {
    cr.sendCustomError(error, params);
  } else {
    warn('TODO');
    return;
  }
};
const addCustomData = (customData: CustomData) => {
  if (cr && Options.enableCrashReporting) {
    cr.addCustomData(customData);
  } else {
    warn('TODO');
    return;
  }
}
const updateCustomData = (updater: (customData: CustomData) => CustomData) => {
  if (cr && Options.enableCrashReporting) {
    cr.updateCustomData(updater);
  } else {
    warn('TODO');
    return;
  }
}
//-------------------------------------------------------------------------------------------------
// REAL USER MONITORING LOGIC
//-------------------------------------------------------------------------------------------------
const sendRUMTimingEvent = (eventType: RUMEvents.ActivityLoaded | RUMEvents.NetworkCall, name: string, timeUsedInMs: number) => {
  if (rum && Options.enableRealUserMonitoring) {
    rum.sendCustomRUMEvent(
      getCurrentUser,
      Options.apiKey,
      eventType,
      name,
      timeUsedInMs,
      ''
    );
  } else {
    warn('TODO');
    return;
  }
};
export {
  init,
  addTag,
  setUser,
  clearSession,
  generateCrashReportPayload,
  recordBreadcrumb,
  addCustomData,
  sendCustomError,
  updateCustomData,
  sendRUMTimingEvent
};
