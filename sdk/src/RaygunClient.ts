/**
 * The RaygunClient is responsible for managing the users access to Real User Monitoring and
 * Crash Reporting functionality as well as managing Session specific data.
 */

import {
  BeforeSendHandler,
  Breadcrumb,
  CustomData,
  LogLevel,
  ManualCrashReportDetails,
  RaygunClientOptions,
  RealUserMonitoringTimings,
  User,
} from './Types';
import {
  anonUser,
  getCurrentTags,
  getCurrentUser,
  setCurrentTags,
  setCurrentUser,
  removeNullFields,
} from './Utils';
import CrashReporter from './CrashReporter';
import RealUserMonitor from './RealUserMonitor';
import {NativeModules} from 'react-native';
import RaygunLogger from './RaygunLogger';
const {RaygunNativeBridge} = NativeModules;

/**
 * The RaygunClient is the interface in which this provider publicly shows. The bottom of this page
 * has an 'export' statement which exports the methods defined in the RaygunClient.ts file. Some
 * of the logical components have been separated out from this file and into classes specific to
 * CrashReporting or RealUserMonitoring (CrashReporter.ts and RealUserMonitor.ts respectively).
 */

// Raygun Client Global Variables
let crashReporter: CrashReporter;
let realUserMonitor: RealUserMonitor;
let options: RaygunClientOptions;
let initialized: boolean = false;

/**
 * Initializes the RaygunClient with customized options parse in through an instance of a
 * RaygunClientOptions. Anything unmentioned in the RaygunClientOptions will revert
 * to their default values.
 *
 * @param {RaygunClientOptions} raygunClientOptions - The initial settings to configure the Raygun client.
 * @return {boolean} Whether the client was configured successfully.
 */
const init = (raygunClientOptions: RaygunClientOptions) => {
  // Do not reinitialize
  if (initialized) {
    RaygunLogger.w('RaygunClient VERSION already initialized');
    return false;
  }

  options = {...removeNullFields(raygunClientOptions)};

  // Cleans options with defaults
  const {
    apiKey = '',
    version = '',
    enableCrashReporting = false,
    disableNativeCrashReporting = false,
    disableUnhandledPromiseRejectionReporting = false,
    enableRealUserMonitoring = false,
    disableNetworkMonitoring = false,
    customCrashReportingEndpoint = '',
    customRealUserMonitoringEndpoint = '',
    logLevel = LogLevel.warn,
    onBeforeSendingCrashReport = null,
    ignoredURLs = [],
    ignoredViews = [],
    maxErrorReportsStoredOnDevice = CrashReporter.MAX_ERROR_REPORTS_STORED_ON_DEVICE,
    maxBreadcrumbsPerErrorReport = CrashReporter.MAX_BREADCRUMBS_PER_ERROR_REPORT,
  } = options;

  RaygunLogger.init(logLevel);

  RaygunLogger.v('RaygunClientOptions:', options);

  // Enable Crash Reporting
  if (enableCrashReporting) {
    crashReporter = new CrashReporter(
      apiKey,
      disableNativeCrashReporting,
      disableUnhandledPromiseRejectionReporting,
      customCrashReportingEndpoint || '',
      onBeforeSendingCrashReport as BeforeSendHandler,
      version,
      maxErrorReportsStoredOnDevice,
      maxBreadcrumbsPerErrorReport);

    if (!disableNativeCrashReporting) {
      RaygunNativeBridge.initCrashReportingNativeSupport(
        apiKey,
        version,
        customCrashReportingEndpoint || CrashReporter.DEFAULT_RAYGUN_CRASH_REPORTING_ENDPOINT,
      );
    }
  }

  // Enable Real User Monitoring
  if (enableRealUserMonitoring) {
    realUserMonitor = new RealUserMonitor(
      apiKey,
      disableNetworkMonitoring,
      ignoredURLs,
      ignoredViews,
      customRealUserMonitoringEndpoint,
      version);

    // Add the lifecycle event listeners to the bridge.
    RaygunNativeBridge.initRealUserMonitoringNativeSupport();
  }

  initialized = true;
  RaygunLogger.d(`RaygunClient VERSION initialized`);
  return true;
};

/**
 * Append a tag to the current session tags. These tags will be attached to both Crash Reporting
 * errors AND Real User Monitoring requests.
 * @param {string[]} tags - The tag(s) to append to the session.
 */
const setTags = (...tags: string[]) => {
  if (!initialized) {
    RaygunLogger.w('\'setTags\' was called before initializing the client');
    return;
  }

  const newTags = tags ? [...tags] : [];
  setCurrentTags(newTags);

  if (!options.disableNativeCrashReporting) {
    RaygunNativeBridge.setTags(getCurrentTags());
  }

  // Mark a user interaction with the Real User Monitor session
  if (realUserMonitoringAvailable()) realUserMonitor.markSessionInteraction();
};

/**
 * @return {string[]} The currently existing session tags.
 */
const getTags = (): string[] => {
  if (!initialized) {
    RaygunLogger.w('\'getTags\' was called before initializing the client');
    return [];
  }
  return getCurrentTags();
};

/**
 * Set the user for the current session. This WILL overwrite an existing session user with
 * the new one.
 * @param {(User|null)} user - The new name or user object to assign.
 */
const setUser = (user: User | null) => {
  if (!initialized) {
    RaygunLogger.w('\'setUser\' was called before initializing the client');
    return;
  }

  if (realUserMonitoringAvailable()) {
    if (!getUser().isAnonymous) realUserMonitor.rotateRUMSession();
    // User is beginning a new session
    else realUserMonitor.markSessionInteraction(); // User is logging in from anonymous
  }

  // Ensure no values are "NULL"
  user = removeNullFields(user);
  // Defaults:
  const newUser = {
    email: '',
    firstName: '',
    fullName: '',
    identifier: '',
    isAnonymous: false,
    uuid: '',
  };
  Object.assign(newUser, user ? {...user} : anonUser);

  // Update user across the react side
  setCurrentUser(newUser);

  // Update user on the native side
  if (!options.disableNativeCrashReporting) {
    RaygunNativeBridge.setUser(getCurrentUser());
  }
};

/**
 * @return {User} Get the current user object.
 */
const getUser = (): User => {
  if (!initialized) {
    RaygunLogger.w('\'getUser\' was called before initializing the client');
    return anonUser;
  }
  return getCurrentUser();
};

/**
 * Create and store a new Breadcrumb.
 * @param {Breadcrumb} breadcrumb - The breadcrumb object to be recorded.
 */
const recordBreadcrumb = (breadcrumb: Breadcrumb) => {
  if (!crashReportingAvailable()) {
    RaygunLogger.w('\'recordBreadcrumb\' was called before initializing the client');
    return;
  }

  // Ensure no values are "NULL"
  breadcrumb = removeNullFields(breadcrumb);
  // Defaults:
  const newBreadcrumb: Breadcrumb = {
    category: '',
    customData: {},
    level: 'debug',
    message: '',
    timestamp: Date.now(),
    type: 'manual',
  };
  Object.assign(newBreadcrumb, {...breadcrumb});

  // Ensure that no alternative data can be parsed through and overwrite this only option
  newBreadcrumb.type = 'manual';

  crashReporter.recordBreadcrumb(newBreadcrumb);
};

/**
 * @return {Breadcrumb[]} The current breadcrumbs.
 */
const getBreadcrumbs = (): Breadcrumb[] => {
  if (!crashReportingAvailable()) {
    RaygunLogger.w('\'getBreadcrumbs\' was called before initializing the client');
    return [];
  }
  return crashReporter.getBreadcrumbs();
};

/**
 * Removes all breadcrumbs.
 */
const clearBreadcrumbs = () => {
  if (!crashReportingAvailable()) {
    RaygunLogger.w('\'clearBreadcrumbs\' was called before initializing the client');
    return;
  }
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
 * @param {Error} error - The error.
 * @param {ManualCrashReportDetails} details
 * @see CustomData
 */
const sendError = async (error: Error, details?: ManualCrashReportDetails) => {
  if (!crashReportingAvailable()) {
    RaygunLogger.w('\'sendError\' was called before initializing the client');
    return;
  }
  await crashReporter.processManualCrashReport(error, details);
};

/**
 * Appends custom data to the current set of custom data.
 * @param {(CustomData|null)} customData - The custom data to append.
 */
const setCustomData = (customData: CustomData | null) => {
  if (!crashReportingAvailable()) {
    RaygunLogger.w('\'setCustomData\' was called before initializing the client');
    return;
  }
  crashReporter.setCustomData(customData ? customData : {});
};

/**
 * @return {(CustomData|null)} The current set of custom data.
 */
const getCustomData = (): CustomData | null => {
  if (!crashReportingAvailable()) {
    RaygunLogger.w('\'getCustomData\' was called before initializing the client');
    return null;
  }
  return crashReporter.getCustomData();
};

/**
 * Let the user change the size of the CrashReporter cache.
 * @param {number} size - The desired number of reports to being stored on the device.
 */
const setMaxReportsStoredOnDevice = (size: number) => {
  if (!crashReportingAvailable()) {
    RaygunLogger.w('\'setMaxReportsStoredOnDevice\' was called before initializing the client');
    return;
  }
  crashReporter.setMaxReportsStoredOnDevice(size);
};

/**
 * Checks if the CrashReporter has been created (during RaygunClient.init) and if the user enabled
 * the CrashReporter during the init.
 * @return {boolean} Whether the client will perform crash reporting.
 */
const crashReportingAvailable = (): boolean => {
  if (!initialized) return false;
  return !!(crashReporter && options.enableCrashReporting);
};

/**
 * Construct a Real User Monitoring Timing Event and send it to the Real User Monitor to be transmitted.
 * @param {RealUserMonitoringTimings} eventType - Type of Real User Monitoring event.
 * @param {string} name - Name of this event.
 * @param {number} durationMs - Length this event took to execute.
 */
const sendRUMTimingEvent = (eventType: RealUserMonitoringTimings, name: string, durationMs: number) => {
  if (!realUserMonitoringAvailable()) {
    RaygunLogger.w('\'sendRUMTimingEvent\' was called before initializing the client');
    return;
  }
  realUserMonitor.sendCustomRUMEvent(eventType, name, durationMs);
};

/**
 * Checks if the RealUserMonitor has been created (during RaygunClient.init) and if the user enabled
 * the RealUserMonitor during the init.
 * @return {boolean} Whether the client will perform real user monitoring.
 */
const realUserMonitoringAvailable = (): boolean => {
  if (!initialized) return false;
  return !!(realUserMonitor && options.enableRealUserMonitoring);
};

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
  sendRUMTimingEvent,
};
