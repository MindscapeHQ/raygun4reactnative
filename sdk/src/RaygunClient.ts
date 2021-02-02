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
const {RaygunNativeBridge} = NativeModules;

/**
 * The RaygunClient is the interface in which this provider publicly shows. The bottom of this page
 * has an 'export' statement which exports the methods defined in the RaygunClient.ts file. Some
 * of the logical components have been separated out from this file and into classes specific to
 * CrashReporting or RealUserMonitoring (CrashReporter.ts and RealUserMonitor.ts respectively).
 */

//#region ----INITIALIZATION------------------------------------------------------------------------

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
 * @param raygunClientOptions
 */
const init = (raygunClientOptions: RaygunClientOptions) => {
    //Do not reinitialize
    if (initialized) {
        RaygunLogger.w("RaygunClient version already initialized");
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

    RaygunLogger.v("RaygunClientOptions:", options);

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
    RaygunLogger.i(`RaygunClient version initialized`)
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
    if (!initialized) {
        RaygunLogger.w("'setTags' was called before initializing the client");
        return
    }

    let newTags = tags ? [...tags] : [];
    setCurrentTags(newTags);

    if (!options.disableNativeCrashReporting) {
        RaygunNativeBridge.setTags(getCurrentTags());
    }

    //Mark a user interaction with the Real User Monitor session
    if (realUserMonitoringAvailable()) realUserMonitor.markSessionInteraction();
};

/**
 * Returns the currently existing session tags.
 */
const getTags = (): string[] => {
    if (!initialized) {
        RaygunLogger.w("'getTags' was called before initializing the client");
        return []
    }
    return getCurrentTags();
};

/**
 * Set the user for the current session. This WILL overwrite an existing session user with
 * the new one.
 * @param user - The new name or user object to assign.
 */
const setUser = (user: User | null) => {
    if (!initialized) {
        RaygunLogger.w("'setUser' was called before initializing the client");
        return
    }
    ;

    if (realUserMonitoringAvailable()) {
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

    //Update user on the native side
    if (!options.disableNativeCrashReporting) {
        RaygunNativeBridge.setUser(getCurrentUser());
    }
};

/**
 * Get the current user object
 */
const getUser = (): User => {
    if (!initialized) {
        RaygunLogger.w("'getUser' was called before initializing the client");
        return anonUser
    }
    ;
    return getCurrentUser();
};

//#endregion----------------------------------------------------------------------------------------

//#region ----CRASH REPORTING LOGIC-----------------------------------------------------------------

/**
 * Create and store a new Breadcrumb.
 * @param breadcrumb
 */
const recordBreadcrumb = (breadcrumb: Breadcrumb) => {
    if (!crashReportingAvailable()) {
        RaygunLogger.w("'recordBreadcrumb' was called before initializing the client");
        return
    }
    ;

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
    if (!crashReportingAvailable()) {
        RaygunLogger.w("'getBreadcrumbs' was called before initializing the client");
        return []
    }
    ;
    return crashReporter.getBreadcrumbs();
};

/**
 * Removes all breadcrumbs.
 */
const clearBreadcrumbs = () => {
    if (!crashReportingAvailable()) {
        RaygunLogger.w("'clearBreadcrumbs' was called before initializing the client");
        return
    };
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
    if (!crashReportingAvailable()) {
        RaygunLogger.w("'sendError' was called before initializing the client");
        return
    };
    await crashReporter.processManualCrashReport(error, details);
};

/**
 * Appends custom data to the current set of custom data.
 * @param customData - The custom data to append
 */
const setCustomData = (customData: CustomData | null) => {
    if (!crashReportingAvailable()) {
        RaygunLogger.w("'setCustomData' was called before initializing the client");
        return
    };
    crashReporter.setCustomData(customData ? customData : {});
};

/**
 * Appends custom data to the current set of custom data.
 * @param customData - The custom data to append
 */
const getCustomData = (): CustomData | null => {
    if (!crashReportingAvailable()) {
        RaygunLogger.w("'getCustomData' was called before initializing the client");
        return null
    };
    return crashReporter.getCustomData();
};

/**
 * Let the user change the size of the CrashReporter cache
 * @param size
 */
const setMaxReportsStoredOnDevice = (size: number) => {
    if (!crashReportingAvailable()) {
        RaygunLogger.w("'setMaxReportsStoredOnDevice' was called before initializing the client");
        return
    };
    crashReporter.setMaxReportsStoredOnDevice(size);
};

/**
 * Checks if the CrashReporter has been created (during RaygunClient.init) and if the user enabled
 * the CrashReporter during the init.
 */
const crashReportingAvailable = (): boolean => {
    if (!initialized) return false;
    return !!(crashReporter && options.enableCrashReporting);
};

//#endregion----------------------------------------------------------------------------------------

//#region ----REAL USER MONITORING LOGIC------------------------------------------------------------

/**
 * Construct a Real User Monitoring Timing Event and send it to the Real User Monitor to be transmitted.
 * @param eventType - Type of Real User Monitoring event.
 * @param name - Name of this event.
 * @param durationMs - Length this event took to execute.
 */
const sendRUMTimingEvent = (eventType: RealUserMonitoringTimings, name: string, durationMs: number) => {
    if (!realUserMonitoringAvailable()) {
        RaygunLogger.w("'sendRUMTimingEvent' was called before initializing the client");
        return
    };
    realUserMonitor.sendCustomRUMEvent(eventType, name, durationMs);
};

/**
 * Checks if the RealUserMonitor has been created (during RaygunClient.init) and if the user enabled
 * the RealUserMonitor during the init.
 */
const realUserMonitoringAvailable = (): boolean => {
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
