/**
 * The RaygunClient is responsible for managing the users access to Real User Monitoring and
 * Crash Reporting functionality as well as managing Session specific data.
 */

import {
  BreadcrumbOption,
  CustomData,
  RaygunClientOptions,
  RealUserMonitoringEvents,
  Session,
  User,
  RealUserMonitoringAssetType
} from './Types';
import { clone, getDeviceBasedId, log, warn } from './Utils';
import CrashReporter from './CrashReporter';
import RealUserMonitor from './RealUserMonitor';
import { NativeModules } from 'react-native';

/**
 * The RaygunClient is the interface in which this provider publicly shows. The bottom of this page
 * has an 'export' statement which exports the methods defined in the RaygunClient.ts file. Some
 * of the logical components have been separated out from this file and into classes specific to
 * CrashReporting or RealUserMonitoring (CrashReporter.ts and RealUserMonitor.ts respectively).
 */



//#region ----INITIALIZATION------------------------------------------------------------------------

const { RaygunNativeBridge } = NativeModules;

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
let initialized: boolean = false;

/**
 * Initializes the RaygunClient with customized options parse in through an instance of a
 * RaygunClientOptions. Anything unmentioned in the RaygunClientOptions will revert
 * to their default values.
 *
 * @param raygunClientOptions
 */
const init = async (raygunClientOptions: RaygunClientOptions) => {
  options = clone(raygunClientOptions);

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

  //Do not reinitialize
  if (initialized) {
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

  //Enable Crash Reporting
  if (enableCrashReporting) {
    crashReporter = new CrashReporter(
      curSession,
      apiKey,
      disableNetworkMonitoring,
      customCrashReportingEndpoint || '',
      onBeforeSendingCrashReport,
      version
    );


  }
  //Enable Real User Monitoring
  if (enableRealUserMonitoring) {
    realUserMonitor = new RealUserMonitor(
      curSession,
      apiKey,
      disableNetworkMonitoring,
      ignoredURLs,
      customRealUserMonitoringEndpoint,
      version
    );
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
const addTag = (...tags: string[]) => {
  tags.forEach(tag => {
    curSession.tags.add(tag);
  });
  if (!options.disableNativeCrashReporting) {
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
    { firstName: '', fullName: '', email: '', isAnonymous: true },
    typeof user === 'string'
      ? !!user
        ? { identifier: user, isAnonymous: true }
        : { identifier: `anonymous-${getDeviceBasedId()}`, isAnonymous: true }
      : user
  );
  curSession.user = userObj;
  if (!options.disableNativeCrashReporting) {
    RaygunNativeBridge.setUser(userObj);
  }
};

/**
 * Clear all session data and reset the Crash Reporter and Real User Monitor.
 */
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
 * Create and store a new Breadcrumb.
 * @param message - A string to describe what this breadcrumb signifies.
 * @param details - Details about the breadcrumb.
 */
const recordBreadcrumb = (message: string, details?: BreadcrumbOption) => {
  if (!CrashReportingAvailable('recordBreadcrumb')) return;
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
 * 1)   RaygunClient.sendError(new Error(), {[Date.now()]: `This is just an example`}, "Foo", "Bar");
 * 2)   RaygunClient.sendError(new Error(), {[Date.now()]: `This is just an example`});
 * 3)   RaygunClient.sendError(new Error(), "Foo", "Bar");
 *
 * @param error - The error.
 * @param params - Custom data or tags alongside the error.
 * @see CustomData
 */
const sendError = async (error: Error, ...params: any) => {
  if (!CrashReportingAvailable('sendError')) return;

  const [customData, tags] = params.length == 1 && Array.isArray(params[0]) ? [null, params[0]] : params;

  if (customData) {
    addCustomData(customData as CustomData);
  }
  if (tags && tags.length) {
    addTag(...(tags as string[]));
  }

  await crashReporter.processUnhandledError(error);
};

/**
 * Appends custom data to the current set of custom data.
 * @param customData - The custom data to append
 */
const addCustomData = (customData: CustomData) => {
  if (!CrashReportingAvailable('addCustomData')) return;
  crashReporter.addCustomData(customData);
};

/**
 * Apply some transformation lambda to all of the user's custom data.
 * @param updater - The transformation.
 */
const updateCustomData = (updater: (customData: CustomData) => CustomData) => {
  if (!CrashReportingAvailable('updateCustomData')) return;
  crashReporter.updateCustomData(updater);
};

/**
 * Checks if the CrashReporter has been created (during RaygunClient.init) and if the user enabled
 * the CrashReporter during the init.
 */
const CrashReportingAvailable = (calledFrom: string) => {
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
const sendRUMTimingEvent = (
  eventType: RealUserMonitoringAssetType.ViewLoaded | RealUserMonitoringAssetType.NetworkCall,
  name: string,
  timeUsedInMs: number
) => {
  if (!RealUserMonitoringAvailable('sendRUMTimingEvent')) return;
  realUserMonitor.sendCustomRUMEvent(eventType, name, timeUsedInMs);
};

/**
 * Checks if the RealUserMonitor has been created (during RaygunClient.init) and if the user enabled
 * the RealUserMonitor during the init.
 */
const RealUserMonitoringAvailable = (calledFrom: string) => {
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
  addTag,
  setUser,
  clearSession,
  recordBreadcrumb,
  addCustomData,
  sendError,
  updateCustomData,
  sendRUMTimingEvent
};
