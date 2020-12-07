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
let initialised: boolean = false;

/**
 * RaygunClient initializer. Creates the CrashReporter and RealUserMonitor.
 * @param options
 */
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
    await RaygunNativeBridge.init({
      apiKey,
      enableRealUserMonitoring,
      version,
      customCrashReportingEndpoint
    });
  }

  //enable CR
  if (enableCrashReporting) {
    crashReporter = new CrashReporter(curSession, apiKey, disableNetworkMonitoring, customCrashReportingEndpoint || '', onBeforeSendingCrashReport, version);
  }
  //Enable realUserMonitor
  if (enableRealUserMonitoring) {
    realUserMonitor = new RealUserMonitor(curSession, apiKey, disableNetworkMonitoring, ignoredURLs, customRealUserMonitoringEndpoint, version);
  }

  initialised = true;

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
/**
 * Converts an incoming error and its stacktrace to a standard Raygun Crash Report format.
 * @param error
 * @param stackFrames
 */
const generateCrashReportPayload = (error: Error, stackFrames: StackFrame[]) => {
  if (CrashReportingUnavailable()) return;
  crashReporter.generateCrashReportPayload(error, stackFrames).then();
};


/**
 * Create a breadcrumb in the current session.
 * @param message
 * @param details
 */
const recordBreadcrumb = (message: string, details?: BreadcrumbOption) => {
  if (CrashReportingUnavailable()) return;
  crashReporter.recordBreadcrumb(message, details);

};
const sendCustomError = async (error: Error, ...params: any) => {
  if (CrashReportingUnavailable()) return;

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
  if (CrashReportingUnavailable()) return;
  crashReporter.addCustomData(customData);

}
const updateCustomData = (updater: (customData: CustomData) => CustomData) => {
  if (CrashReportingUnavailable()) return;
  crashReporter.updateCustomData(updater);
}

/**
 * Checks whether or not the user has initialised the client AND enabled crash reporting.
 * @constructor
 */
const CrashReportingUnavailable = () => {
  if (!initialised) {
    warn('RaygunClient has not been initialised, please call RaygunClient.init(...) before trying to use Raygun features');
    return true;
  } else if (!(crashReporter && Options.enableCrashReporting)) {
    warn('Crash Reporting not enabled, please that you set "enableCrashReporting" to true during RaygunClient.init()');
    return true;
  }
  return false;
}

//-------------------------------------------------------------------------------------------------
// REAL USER MONITORING LOGIC
//-------------------------------------------------------------------------------------------------
const sendRUMTimingEvent = (eventType: RealUserMonitoringEvents.ActivityLoaded | RealUserMonitoringEvents.NetworkCall, name: string, timeUsedInMs: number) => {
  if (RealUserMonitoringUnavailable()) return;
  realUserMonitor.sendCustomRUMEvent(
    Options.apiKey,
    eventType,
    name,
    timeUsedInMs,
    ''
  );
};

const RealUserMonitoringUnavailable = () => {
  if (!initialised) {
    warn('RaygunClient has not been initialised, please call RaygunClient.init(...) before trying to use Raygun features');
    return true;
  }
  if (!(realUserMonitor && Options.enableRealUserMonitoring)) {
    warn('Real User Monitoring not enabled, please that you set "enableRealUserMonitoring" to true during RaygunClient.init()');
    return true;
  }
  return false;
}


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
