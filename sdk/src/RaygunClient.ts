/**
 * The RaygunClient is responsible for managing the users access to Real User Monitoring and
 * Crash Reporting functionality as well as managing Session specific data.
 */

import {
  CustomData,
  RaygunClientOptions,
  User,
  RealUserMonitoringTimings,
  BeforeSendHandler,
  anonUser,
  Breadcrumb
} from './Types';
import { getCurrentTags, getDeviceBasedId, log, setCurrentTags, setCurrentUser, getCurrentUser, warn } from './Utils';
import CrashReporter from './CrashReporter';
import RealUserMonitor from './RealUserMonitor';
import { Animated, NativeModules } from 'react-native';
import event = Animated.event;

const { RaygunNativeBridge } = NativeModules;

/**
 * The RaygunClient is the interface in which this provider publicly shows. The bottom of this page
 * has an 'export' statement which exports the methods defined in the RaygunClient.ts file. Some
 * of the logical components have been separated out from this file and into classes specific to
 * CrashReporting or RealUserMonitoring (CrashReporter.ts and RealUserMonitor.ts respectively).
 */

//#region ----INITIALIZATION------------------------------------------------------------------------

let crashReporter: CrashReporter;
let realUserMonitor: RealUserMonitor;
let options: RaygunClientOptions;
// Raygun Client Global Variables
let initialized: boolean = false;

/**
 * Initializes the RaygunClient with customized options parse in through an instance of a
 * RaygunClientOptions. Anything unmentioned in the RaygunClientOptions will revert
 * to their default values.
 *
 * @param raygunClientOptions
 */
const init = (raygunClientOptions: RaygunClientOptions) => {
  //Do not reinitialize
  if (initialized) {
    log('Already initialized');
    return false;
  }

  options = { ...raygunClientOptions };

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

  //Enable Crash Reporting
  if (enableCrashReporting) {
    crashReporter = new CrashReporter(
      apiKey,
      disableNativeCrashReporting,
      customCrashReportingEndpoint || '',
      onBeforeSendingCrashReport as BeforeSendHandler,
      version
    );
    if (!disableNativeCrashReporting) {
      log('Native Bridge Initialized');
      RaygunNativeBridge.initCrashReportingNativeSupport(apiKey, version, customCrashReportingEndpoint);
    }
  }

  //Enable Real User Monitoring
  if (enableRealUserMonitoring) {
    realUserMonitor = new RealUserMonitor(
      apiKey,
      disableNetworkMonitoring,
      ignoredURLs,
      customRealUserMonitoringEndpoint,
      version
    );
    // Add the lifecycle event listeners to the bridge.
    RaygunNativeBridge.initRealUserMonitoringNativeSupport();
  }

  initialized = true;

  return true;
};

//#endregion----------------------------------------------------------------------------------------

//#region ----RAYGUN CLIENT SESSION LOGIC-----------------------------------------------------------

/**
 * Append a tag to the current session tags. These tags will be attached to both Crash Reporting
 * errors AND Real User Monitoring requests.
 * @param tags - The tag(s) to append to the session.
 */
const setTags = (...tags: string[]) => {
  let newTags = tags ? [...tags] : [];
  setCurrentTags(newTags);
  if (!options.disableNativeCrashReporting) {
    RaygunNativeBridge.setTags(getCurrentTags());
  }
  //Mark a user interaction with the Real User Monitor session
  if (realUserMonitoringAvailable('setTags')) realUserMonitor.markSessionInteraction();
};

const getTags = (): string[] => {
  return getCurrentTags();
};

/**
 * Set the user for the current session. This WILL overwrite an existing session user with
 * the new one.
 * @param user - The new name or user object to assign.
 */
const setUser = (user: User) => {
  if (realUserMonitoringAvailable('setUser')) {
    if (!getUser().isAnonymous) realUserMonitor.rotateRUMSession();
    //User is beginning a new session
    else realUserMonitor.markSessionInteraction(); //User is logging in from anonymous
  }

  //Update user across the react side
  setCurrentUser(user ? { ...user } : anonUser);

  //Update user on the native side
  if (!options.disableNativeCrashReporting) {
    RaygunNativeBridge.setUser(getCurrentUser());
  }
};

const getUser = (): User => {
  return getCurrentUser();
};

//#endregion----------------------------------------------------------------------------------------

//#region ----CRASH REPORTING LOGIC-----------------------------------------------------------------

/**
 * Create and store a new Breadcrumb.
 * @param message - A string to describe what this breadcrumb signifies.
 * @param details - Details about the breadcrumb.
 */
const recordBreadcrumb = (breadcrumb: Breadcrumb) => {
  if (!crashReportingAvailable('recordBreadcrumb')) return;
  crashReporter.recordBreadcrumb(breadcrumb);
};

/**
 * Returns the current breadcrumbs.
 */
const getBreadcrumbs = (): Breadcrumb[] => {
  if (!crashReportingAvailable('getBreadcrumbs')) return [];
  return crashReporter.getBreadcrumbs();
};

/**
 * Removes all breadcrumbs.
 */
const clearBreadcrumbs = () => {
  if (!crashReportingAvailable('clearBreadcrumbs')) return;
  crashReporter.clearBreadcrumbs();
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
 * 1)   RaygunClient.sendError(new Error(), {[Date.now()]: `This is just an example`}, "Foo", "Bar");
 * 2)   RaygunClient.sendError(new Error(), {[Date.now()]: `This is just an example`});
 * 3)   RaygunClient.sendError(new Error(), "Foo", "Bar");
 *
 * @param error - The error.
 * @param params - Custom data or tags alongside the error.
 * @see CustomData
 */
const sendError = async (error: Error, ...params: any) => {
  if (!crashReportingAvailable('sendError')) return;
  await crashReporter.processManualCrashReport(error, params);
};

/**
 * Appends custom data to the current set of custom data.
 * @param customData - The custom data to append
 */
const setCustomData = (customData: CustomData | null) => {
  if (!crashReportingAvailable('setCustomData')) return;
  crashReporter.setCustomData(customData ? customData : {});
};

/**
 * Appends custom data to the current set of custom data.
 * @param customData - The custom data to append
 */
const getCustomData = () => {
  if (!crashReportingAvailable('setCustomData')) return;
  return crashReporter.getCustomData();
};

/**
 * Let the user change the size of the CrashReporter cache
 * @param size
 */
const setMaxReportsStoredOnDevice = (size: number) => {
  if (!crashReportingAvailable('setCrashReportCacheSize')) return;
  crashReporter.setMaxReportsStoredOnDevice(size);
};

/**
 * Checks if the CrashReporter has been created (during RaygunClient.init) and if the user enabled
 * the CrashReporter during the init.
 */
const crashReportingAvailable = (calledFrom: string) => {
  if (!initialized) {
    warn(
      `Failed: "${calledFrom}" cannot be called before initialising RaygunClient. Please call RaygunClient.init(...) before trying to call RaygunClient.${calledFrom}(...)`
    );
    return false;
  } else if (!(crashReporter && options.enableCrashReporting)) {
    warn(
      `Failed: "${calledFrom}" cannot be called unless Crash Reporting has been enabled, please ensure that you set "enableCrashReporting" to true during RaygunClient.init(...)`
    );
    return false;
  }
  return true;
};

//#endregion----------------------------------------------------------------------------------------

//#region ----REAL USER MONITORING LOGIC------------------------------------------------------------

/**
 * Construct a Real User Monitoring Timing Event and send it to the Real User Monitor to be transmitted.
 * @param eventType - Type of Real User Monitoring event.
 * @param name - Name of this event.
 * @param timeUsedInMs - Length this event took to execute.
 */
const sendRUMTimingEvent = (eventType: RealUserMonitoringTimings, name: string, durationMs: number) => {
  if (!realUserMonitoringAvailable('sendRUMTimingEvent')) return;
  realUserMonitor.sendCustomRUMEvent(eventType, name, durationMs);
};

/**
 * Checks if the RealUserMonitor has been created (during RaygunClient.init) and if the user enabled
 * the RealUserMonitor during the init.
 */
const realUserMonitoringAvailable = (calledFrom: string) => {
  if (!initialized) {
    warn(
      `Failed: "${calledFrom}" cannot be called before initialising RaygunClient. Please call RaygunClient.init(...) before trying to call RaygunClient.${calledFrom}(...)`
    );
    return false;
  }
  if (!(realUserMonitor && options.enableRealUserMonitoring)) {
    warn(
      `Failed: "${calledFrom}" cannot be called unless Real User Monitoring has been enabled, please ensure that you set "enableRealUserMonitoring" to true during RaygunClient.init(...)`
    );
    return false;
  }
  return true;
};

//#endregion----------------------------------------------------------------------------------------

export {
  init,
  setTags,
  getTags,
  setUser,
  getUser,
  recordBreadcrumb,
  getBreadcrumbs,
  clearBreadcrumbs,
  setCustomData,
  getCustomData,
  sendError,
  setMaxReportsStoredOnDevice,
  sendRUMTimingEvent
};
