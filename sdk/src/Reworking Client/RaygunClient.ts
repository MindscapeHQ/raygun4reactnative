import {
  BeforeSendHandler, BreadcrumbOption,
  CrashReportPayload, CustomData,
  RaygunClientOptions,
  RUMEvents,
  Session, User
} from "../Types";
import { getDeviceBasedId, log, warn } from '../Utils';
import {NativeModules} from "react-native";
import CrashReporter from "./CrashReporter";
import RealUserMonitor from "./RealUserMonitor";
import {StackFrame} from "react-native/Libraries/Core/Devtools/parseErrorStack";

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
let CleanedOptions: RaygunClientOptions;


/**
 * RaygunClient initializer. Creates the CrashReporter and RealUserMonitor.
 * @param options
 */
const init = async (options: RaygunClientOptions) => {

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
  } = CleanedOptions;

  //Check if native bridge is available and enabled
  const useNativeCR = !disableNativeCrashReporting && RaygunNativeBridge && typeof RaygunNativeBridge.init === 'function';

  //Has the client already been initialised
  const alreadyInitialized = useNativeCR && (await RaygunNativeBridge.hasInitialized());
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


const addTag = (...tags: string[]) => {
  tags.forEach(tag => {
    curSession.tags.add(tag);
  });
  if (!CleanedOptions.disableNativeCrashReporting) {
    RaygunNativeBridge.setTags([...curSession.tags]);
  }
};


const setUser = (user: User | string) => {
  const userObj = Object.assign(
      { firstName: '', fullName: '', email: '', isAnonymous: false },
      typeof user === 'string' ?
          !!user ?
              {identifier: user}
              : {identifier: `anonymous-${getDeviceBasedId()}`,isAnonymous: true}
          : user
  );
  curSession.user = userObj;
  if (!CleanedOptions.disableNativeCrashReporting) {
    RaygunNativeBridge.setUser(userObj);
  }
};

const clearSession = () => {
  curSession = getCleanSession();
  if (!CleanedOptions.disableNativeCrashReporting) {
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
  if (cr && CleanedOptions.enableCrashReporting) {
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
  if (cr && CleanedOptions.enableCrashReporting) {
    cr.recordBreadcrumb(message, details);
  } else {
    warn('TODO');
    return;
  }
};

const sendCustomError = async (error: Error, ...params: any) => {
  if (cr && CleanedOptions.enableCrashReporting) {
    cr.sendCustomError(error, params);
  } else {
    warn('TODO');
    return;
  }
};

const addCustomData = (customData: CustomData) => {
  if (cr && CleanedOptions.enableCrashReporting) {
    cr.addCustomData(customData);
  } else {
    warn('TODO');
    return;
  }
}

const updateCustomData = (updater: (customData: CustomData) => CustomData) => {
  if (cr && CleanedOptions.enableCrashReporting) {
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
  if (rum && CleanedOptions.enableRealUserMonitoring) {
    rum.sendCustomRUMEvent(
      getCurrentUser,
      CleanedOptions.apiKey,
      eventType,
      name,
      timeUsedInMs,
      CleanedOptions.customRealUserMonitoringEndpoint
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

