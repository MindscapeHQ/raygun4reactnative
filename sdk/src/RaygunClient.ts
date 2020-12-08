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


/**
 * Initializes the RaygunClient with customized options parse in through an instance of a
 * RaygunClientOptions. Anything unmentioned in the RaygunClientOptions will revert
 * to their default values.
 *
 * @param options - An instance of RaygunClientOptions.
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

/**
 * Append a tag to the current session tags. These tags will be attached to both Crash Reporting
 * errors AND Real User Monitoring requests.
 * @param tags - The tag(s) to append to the session.
 */
const addTag = (...tags: string[]) => {
  tags.forEach(tag => {
    curSession.tags.add(tag);
  });
  if (!Options.disableNativeCrashReporting) {
    RaygunNativeBridge.setTags([...curSession.tags]);
  }
};

/**
 * Set the user for the current session. This WILL overwrite an existing session user with
 * the new one.
 * @param user - The new name or user object to assign.
 */
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

/**
 * Clear all session data and reset the Crash Reporter and Real User Monitor.
 */
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
 * Create and store a new Breadcrumb.
 * @param message - A string to describe what this breadcrumb signifies.
 * @param details - Details about the breadcrumb.
 */
const recordBreadcrumb = (message: string, details?: BreadcrumbOption) => {
  if (!CrashReportingAvailable()) return;
  crashReporter.recordBreadcrumb(message, details);

};

/**
 * Allows for an error to be sent to the Crash Reporting error handler along with some customized
 * data. 'params' can be configured in the following ways:
 *    1) data: CustomData, ... tags: string
 *    2) data: CustomData
 *    3) ... tags: string
 *
 * If custom data is being parsed with this method, ensure it is placed first before any tags.
 * Also ensure that the custom data is a CustomData instance, all tags will be strings.
 *
 * @example
 * 1)   RaygunClient.sendCustomError(new Error(), {[Date.now()]: `This is just an example`}, "Foo", "Bar");
 * 2)   RaygunClient.sendCustomError(new Error(), {[Date.now()]: `This is just an example`});
 * 3)   RaygunClient.sendCustomError(new Error(), "Foo", "Bar");
 *
 * @param error - The error.
 * @param params - Custom data or tags alongside the error.
 * @see CustomData
 */
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

/**
 * Appends custom data to the current set of custom data.
 * @param customData - The custom data to append
 */
const addCustomData = (customData: CustomData) => {
  if (!CrashReportingAvailable()) return;
  crashReporter.addCustomData(customData);

}

/**
 * Apply some transformation lambda to all of the user's custom data.
 * @param updater - The transformation.
 */
const updateCustomData = (updater: (customData: CustomData) => CustomData) => {
  if (!CrashReportingAvailable()) return;
  crashReporter.updateCustomData(updater);
}

/**
 * Checks if the CrashReporter has been created (during RaygunClient.init) and if the user enabled
 * the CrashReporter during the init.
 */
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

/**
 * Construct a Real User Monitoring Timing Event and send it to the Real User Monitor to be transmitted.
 * @param eventType - Type of Real User Monitoring event.
 * @param name - Name of this event.
 * @param timeUsedInMs - Length this event took to execute.
 */
const sendRUMTimingEvent = (eventType: RealUserMonitoringEvents.ActivityLoaded | RealUserMonitoringEvents.NetworkCall, name: string, timeUsedInMs: number) => {
  if (!RealUserMonitoringAvailable()) return;
  realUserMonitor.sendCustomRUMEvent(
    eventType,
    name,
    timeUsedInMs
  );
};

/**
 * Checks if the RealUserMonitor has been created (during RaygunClient.init) and if the user enabled
 * the RealUserMonitor during the init.
 */
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
