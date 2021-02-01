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
    User
} from './Types';
import {anonUser, getCurrentTags, getCurrentUser, setCurrentTags, setCurrentUser} from './Utils';
import CrashReporter from './CrashReporter';
import RealUserMonitor from './RealUserMonitor';
import {NativeModules} from 'react-native';
import RaygunLogger from "./RaygunLogger";
import retryTimes = jest.retryTimes;

const {RaygunNativeBridge} = NativeModules;

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
        RaygunLogger.w("RaygunClient already initialized")
        RaygunLogger.i("RaygunClient.init method has already been called for this instance, have you accidentally called it twice?");
        return false;
    }

    options = {...raygunClientOptions};

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
        logLevel = LogLevel.warn,
        onBeforeSendingCrashReport = null,
        ignoredURLs = []
    } = options;

    RaygunLogger.init(logLevel);
    RaygunLogger.v("Received RaygunClientOptions\n", options);

    //Enable Crash Reporting
    if (enableCrashReporting) {
        crashReporter = new CrashReporter(
            apiKey,
            disableNativeCrashReporting,
            customCrashReportingEndpoint || '',
            onBeforeSendingCrashReport as BeforeSendHandler,
            version
        );

        crashReporter ? RaygunLogger.d("Instantiated Crash Reporting successfully") : RaygunLogger.w("Crash Reporting failed to instantiate");
        RaygunLogger.v("CrashReporter: \n", crashReporter);

        if (!disableNativeCrashReporting) {
            RaygunLogger.i("Instantiating native support for Crash Reporting");
            RaygunNativeBridge.initCrashReportingNativeSupport(apiKey, version, customCrashReportingEndpoint);
            RaygunLogger.d("Instantiated Native Crash Reporting");
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

        realUserMonitor ? RaygunLogger.d("Instantiated Real User Monitoring successfully") : RaygunLogger.w("Real User Monitoring failed to instantiate");

        // Add the lifecycle event listeners to the bridge.
        RaygunLogger.i("Instantiating native support for Real User Monitoring");
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
    RaygunLogger.d("Attempting to run 'setTags'");

    if (!initialized) return;

    let newTags = tags ? [...tags] : [];
    setCurrentTags(newTags);
    if (!options.disableNativeCrashReporting) {
        RaygunNativeBridge.setTags(getCurrentTags());
    }
    //Mark a user interaction with the Real User Monitor session
    if (realUserMonitoringAvailable('setTags')) realUserMonitor.markSessionInteraction();


    RaygunLogger.i("'setTags' called");
};

const getTags = (): string[] => {
    RaygunLogger.d("Attempting to run 'getTags'");
    if (!initialized) return[];
    RaygunLogger.v("Returning tags: \n", getCurrentTags());
    return getCurrentTags();
};

/**
 * Set the user for the current session. This WILL overwrite an existing session user with
 * the new one.
 * @param user - The new name or user object to assign.
 */
const setUser = (user: User | null) => {
    RaygunLogger.d("Attempting to run 'setUser'");

    if (!initialized) return;

    if (realUserMonitoringAvailable('setUser')) {
        if (!getUser().isAnonymous) realUserMonitor.rotateRUMSession();
        //User is beginning a new session
        else realUserMonitor.markSessionInteraction(); //User is logging in from anonymous
    }


    // Ensure no values are "NULL"
    const newUser = {
        email: "",
        firstName: "",
        fullName: "",
        identifier: "",
        isAnonymous: false,
        uuid: ""
    };
    Object.assign(newUser, user ? {...user} : anonUser);

    //Update user across the react side
    setCurrentUser(newUser);

    RaygunLogger.i("User has been set");
    RaygunLogger.v("User set to: \n", getUser());

    //Update user on the native side
    if (!options.disableNativeCrashReporting) {
        RaygunLogger.d("Attempting to run 'setUser' natively");
        RaygunNativeBridge.setUser(getCurrentUser());
    }
};

/**
 * Get the current user object
 */
const getUser = (): User => {
    RaygunLogger.d("Attempting to run 'getUser'");
    if (!initialized) return anonUser;
    RaygunLogger.v("Returning user:\n", getCurrentUser());
    return getCurrentUser();
};

//#endregion----------------------------------------------------------------------------------------

//#region ----CRASH REPORTING LOGIC-----------------------------------------------------------------

/**
 * Create and store a new Breadcrumb.
 * @param breadcrumb
 */
const recordBreadcrumb = (breadcrumb: Breadcrumb) => {
    RaygunLogger.d("Attempting to run 'recordBreadcrumb'");
    if (!crashReportingAvailable('recordBreadcrumb')) return;

    const newBreadcrumb: Breadcrumb = {
        category: "",
        customData: {},
        level: "debug",
        message: "",
        timestamp: Date.now()
    }
    Object.assign(newBreadcrumb, {...breadcrumb})

    crashReporter.recordBreadcrumb(newBreadcrumb);
};

/**
 * Returns the current breadcrumbs.
 */
const getBreadcrumbs = (): Breadcrumb[] => {
    RaygunLogger.d("Attempting to run 'getBreadcrumbs'");
    if (!crashReportingAvailable('getBreadcrumbs')) return [];
    return crashReporter.getBreadcrumbs();
};

/**
 * Removes all breadcrumbs.
 */
const clearBreadcrumbs = () => {
    RaygunLogger.d("Attempting to run 'clearBreadcrumbs'");
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
 * @param details
 * @see CustomData
 */
const sendError = async (error: Error, details?: ManualCrashReportDetails) => {
    RaygunLogger.d("Attempting to run 'sendError'");
    if (!crashReportingAvailable('sendError')) return;
    await crashReporter.processManualCrashReport(error, details);
};

/**
 * Appends custom data to the current set of custom data.
 * @param customData - The custom data to append
 */
const setCustomData = (customData: CustomData | null) => {
    RaygunLogger.d("Attempting to run 'setCustomData'");
    if (!crashReportingAvailable('setCustomData')) return;
    crashReporter.setCustomData(customData ? customData : {});
};

/**
 * Appends custom data to the current set of custom data.
 * @param customData - The custom data to append
 */
const getCustomData = (): CustomData | null => {
    RaygunLogger.d("Attempting to run 'getCustomData'");
    if (!crashReportingAvailable('setCustomData')) return null;
    return crashReporter.getCustomData();
};

/**
 * Let the user change the size of the CrashReporter cache
 * @param size
 */
const setMaxReportsStoredOnDevice = (size: number) => {
    RaygunLogger.d("Attempting to run 'setMaxReportsStoredOnDevice'");
    if (!crashReportingAvailable('setCrashReportCacheSize')) return;
    crashReporter.setMaxReportsStoredOnDevice(size);
};

/**
 * Checks if the CrashReporter has been created (during RaygunClient.init) and if the user enabled
 * the CrashReporter during the init.
 */
const crashReportingAvailable = (calledFrom: string): boolean => {
    if(!initialized) return false;
    return !!(crashReporter && options.enableCrashReporting);
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
const realUserMonitoringAvailable = (calledFrom: string):boolean => {
    RaygunLogger.d("Attempting to run 'realUserMonitoringAvailable'");
    if (!initialized) return false;
    return !!(realUserMonitor && options.enableRealUserMonitoring);
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
