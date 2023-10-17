import {cleanFilePath, filterOutReactFrames, getCurrentTags, getCurrentUser, noAddressAt, upperFirst} from './Utils';
import {BeforeSendHandler, Breadcrumb, CrashReportPayload, CustomData, ManualCrashReportDetails} from './Types';
import {StackFrame} from 'react-native/Libraries/Core/Devtools/parseErrorStack';
import {NativeModules, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RaygunLogger from './RaygunLogger';

const {RaygunNativeBridge} = NativeModules;
const {version: clientVersion} = require('../package.json');

/**
 * The Crash Reporter is responsible for all of the functionality related to generating, catching
 * formatting, caching and transmitting Crash Reports as well as managing users custom data
 * (breadcrumbs and customData).
 */
export default class CrashReporter {
  public static readonly MAX_ERROR_REPORTS_STORED_ON_DEVICE = 64;
  public static readonly MAX_BREADCRUMBS_PER_ERROR_REPORT = 32;
  public static readonly DEFAULT_RAYGUN_CRASH_REPORTING_ENDPOINT = 'https://api.raygun.com/entries';

  private readonly LOCAL_STORAGE_KEY = 'raygun4reactnative_local_storage';
  private readonly RAYGUN_RATE_LIMITING_STATUS_CODE = 429;

  private breadcrumbs: Breadcrumb[] = [];
  private customData: CustomData = {};
  private apiKey: string;
  private version: string;
  private disableNativeCrashReporting: boolean;
  private onBeforeSendingCrashReport: BeforeSendHandler | null;
  private raygunCrashReportEndpoint = CrashReporter.DEFAULT_RAYGUN_CRASH_REPORTING_ENDPOINT;
  private maxErrorReportsStoredOnDevice: number;
  private maxBreadcrumbsPerErrorReport: number;

  /**
   * Initialise Javascript side error/promise rejection handlers and identify whether the Native or
   * Javascript side should be responsible for caching Crash Reports.
   *
   * @param {string} apiKey - Access key for Raygun API.
   * @param {boolean} disableNativeCrashReporting - Whether or not to enable Native side error reporting.
   * @param {boolean} disableUnhandledPromiseRejectionReporting - Whether or not to enable unhandled promise rejection reporting.
   * @param {string} customCrashReportingEndpoint - Custom endpoint for Crash Report (may be empty or null).
   * @param {BeforeSendHandler} onBeforeSendingCrashReport - A lambda to execute before each Crash Report transmission.
   * @param {string} version - The current version of the RaygunClient.
   * @param {number} maxErrorReportsStoredOnDevice - The total number of error reports that can be in local storage at one time.
   * @param {number} maxBreadCrumbsPerErrorReport - The total number of breadcrumbs an error report can contain.
   */
  constructor(
    apiKey: string,
    disableNativeCrashReporting: boolean,
    disableUnhandledPromiseRejectionReporting: boolean,
    customCrashReportingEndpoint: string,
    onBeforeSendingCrashReport: BeforeSendHandler | null,
    version: string,
    maxErrorReportsStoredOnDevice: number,
    maxBreadCrumbsPerErrorReport: number,
  ) {
    // Assign the values parsed in (assuming initiation is the only time these are altered)
    this.apiKey = apiKey;
    this.disableNativeCrashReporting = disableNativeCrashReporting;
    this.onBeforeSendingCrashReport = onBeforeSendingCrashReport;
    this.version = version;

    this.maxErrorReportsStoredOnDevice = Math.min(
      Math.max(maxErrorReportsStoredOnDevice, 0), CrashReporter.MAX_ERROR_REPORTS_STORED_ON_DEVICE);

    this.maxBreadcrumbsPerErrorReport = Math.min(
      Math.max(maxBreadCrumbsPerErrorReport, 0), CrashReporter.MAX_BREADCRUMBS_PER_ERROR_REPORT);

    if (customCrashReportingEndpoint && customCrashReportingEndpoint.length > 0) {
      this.raygunCrashReportEndpoint = customCrashReportingEndpoint;
    }

    // Set up error handler to divert errors to crash reporter
    const prevHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler(async (error: Error, isFatal?: boolean) => {
      await this.processUnhandledError(error, isFatal);
      prevHandler && prevHandler(error, isFatal);
    });

    if (!disableUnhandledPromiseRejectionReporting) {
      const {polyfillGlobal} = require('react-native/Libraries/Utilities/PolyfillFunctions');
      const Promise = require('promise/setimmediate/es6-extensions');
      const tracking = require('promise/setimmediate/rejection-tracking');
      require('promise/setimmediate/done');
      require('promise/setimmediate/finally');

      // Set up rejection handler to divert rejections to crash reporter
      polyfillGlobal('Promise', () => {
        tracking.enable({
          allRejections: true,
          onUnhandled: this.processUnhandledRejection.bind(this),
        });

        return Promise;
      });
    }

    this.resendCachedReports().then((r) => {});
  }

  /**
   * Append some custom data to the users current set of custom data.
   * @param {CustomData} customData - The custom data to append.
   */
  setCustomData(customData: CustomData) {
    this.customData = {...customData};
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.setCustomData({...customData});
    }
  }

  /**
   * @return {(CustomData|null)} The custom data as an immutable.
   */
  getCustomData() {
    // If this object isnt empty then return it
    for (const prop in this.customData) {
      if (this.customData.hasOwnProperty(prop)) return this.customData;
    }

    return null;
  }

  /**
   * Create and store a new Breadcrumb.
   * @param {Breadcrumb} breadcrumb
   */
  recordBreadcrumb(breadcrumb: Breadcrumb) {

    /**
       Android does not seem to handle the mismatched types gracefully like how iOS does.
       Therefore we need to an additional check to avoid users app from crashing
    **/

    breadcrumb.message = JSON.stringify(breadcrumb.message);

    this.breadcrumbs.push({...breadcrumb});

    if (this.breadcrumbs.length > this.maxBreadcrumbsPerErrorReport) {
      this.breadcrumbs.shift();
    }

    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.recordBreadcrumb(breadcrumb);
    }
  }

  /**
   * Removes all breadcrumbs.
   */
  clearBreadcrumbs() {
    this.breadcrumbs = [];
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.clearBreadcrumbs();
    }
  }

  /**
   * @return {Breadcrumb[]} The current breadcrumbs.
   */
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Retrieve and format the local Crash Report cache as a JSON array.
   */
  async getCachedCrashReports() : Promise<CrashReportPayload[]> {
    try {
      const rawCache = await AsyncStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (rawCache !== null) {
        try {
          return JSON.parse(rawCache);
        } catch (e) {
          RaygunLogger.e('Unable to extract payload from cache:', {error: e.message, cache: rawCache});
        }
      }
    } catch (e) {
      RaygunLogger.e('Unable to get access local storage:', e.message);
    }
    return [];
  }

  /**
   * Override the local Crash Report cache with a new JSON array.
   * @param {CrashReportPayload[]} newCache - The new JSON array to override with.
   */
  async setCachedCrashReports(newCache : CrashReportPayload[]) {
    try {
      await AsyncStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(newCache));
    } catch (e) {
      RaygunLogger.e('Unable to access local storage');
    }
  }

  /**
   * Append a set of Crash Reports to the cache if it isn't already full.
   * @param {CrashReportPayload[]} reports - Reports to append.
   */
  async cacheCrashReports(...reports: CrashReportPayload[]) {
    let appendedCache : CrashReportPayload[] = (await this.getCachedCrashReports()).concat(reports);

    // If the cache is already full then ignore this report
    if (appendedCache.length >= this.maxErrorReportsStoredOnDevice) {
      appendedCache = appendedCache.slice(0, this.maxErrorReportsStoredOnDevice);
    }

    await this.setCachedCrashReports(appendedCache);
  }

  /**
   * Attempt to send all cached reports, re-caching any that fail to send.
   */
  async resendCachedReports() {
    const cache : CrashReportPayload[] = await this.getCachedCrashReports();
    const reCache : CrashReportPayload[] = [];

    for (let i = 0; i < cache.length; i++) {
      await this.sendCrashReport(cache[i]).then((success) => {
        if (!success) reCache.push(cache[i]);
      });
    }

    this.setCachedCrashReports(reCache);
  }

  /**
   * Set the maximum size of the local cache.
   * @param {number} newSize - The desired number of reports to being stored on the device.
   */
  async setMaxReportsStoredOnDevice(newSize: number) {
    // Set the maximum keeping between a range of [0, 64]
    this.maxErrorReportsStoredOnDevice = Math.min(
      Math.max(newSize, 0), CrashReporter.MAX_ERROR_REPORTS_STORED_ON_DEVICE);

    // Remove excess cached reports where necessary, prioritising older reports
    const cache : CrashReportPayload[] = await this.getCachedCrashReports();
    if (cache.length > this.maxErrorReportsStoredOnDevice) {
      await this.setCachedCrashReports(cache.slice(0, this.maxErrorReportsStoredOnDevice));
    }
  }

  /**
   * The error handler method to catch react errors and route them to the CrashReporter.
   * @param {Error} error - The caught error.
   * @param {boolean} isFatal - Whether or not the error was fatal.
   */
  async processUnhandledError(error: Error, isFatal?: boolean) {
    if (!error || !error.stack) {
      return;
    }

    const stack = await this.cleanStackTrace(error);

    const payload = await this.generateCrashReportPayload(error, stack);
    payload.Details.Tags = getCurrentTags().concat('UnhandledError');

    if (isFatal) {
      payload.Details.Tags = getCurrentTags().concat('Fatal');
    }

    this.managePayload(payload);
  }

  /**
   * Processes a manually sent error (using local tags).
   * @param {Error} error - The Error to be processed.
   * @param {ManualCrashReportDetails} details - The error report details.
   */
  async processManualCrashReport(error: Error, details?: ManualCrashReportDetails) {
    if (!error || !error.stack) {
      return;
    }

    const stack = await this.cleanStackTrace(error);

    const payload = await this.generateCrashReportPayload(error, stack);

    const payloadWithLocalParams: CrashReportPayload = {...payload};

    if (details) {
      if (details.customData) {
        payloadWithLocalParams.Details.UserCustomData = Object.assign({...this.customData}, details.customData);
      }
      if (details.tags) {
        payloadWithLocalParams.Details.Tags = getCurrentTags().concat(details.tags);
      }
    }

    this.managePayload(payloadWithLocalParams);
  }

  /**
   * Cleans the stack trace of some error.
   * @param {Error} error - The error to be cleaned.
   */
  async cleanStackTrace(error: Error) {
    // Extract the errors stack trace
    const parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack');

    let stackFrames;
    try {
      stackFrames = parseErrorStack(error);
    } catch (e) {
      // parseErrorStack in ReactNative 0.64 requires a string
      stackFrames = parseErrorStack(error.stack);
    }

    // Clean the stack trace and check for empty stack trace
    const cleanedStackFrames: StackFrame[] = cleanFilePath(stackFrames);

    return cleanedStackFrames || [].filter(filterOutReactFrames).map(noAddressAt);
  }

  /**
   * Modifies and sends the Crash Report Payload (manages beforeSendHandler).
   * @param {CrashReportPayload} payload - The payload to send away.
   */
  managePayload(payload: CrashReportPayload) {
    const modifiedPayload =
      this.onBeforeSendingCrashReport && typeof this.onBeforeSendingCrashReport === 'function' ?
        this.onBeforeSendingCrashReport(Object.freeze(payload)) :
        payload;

    if (!modifiedPayload) {
      return;
    }

    RaygunLogger.v('Crash Report Payload:', modifiedPayload);

    // Send the Crash Report, caching it if the transmission is not successful
    this.sendCrashReport(modifiedPayload).then((success) => {
      if (!success) this.cacheCrashReports(modifiedPayload);
      else {
        this.resendCachedReports();
      }
    });
  }

  /**
   * The promise rejection handler to catch and reroute rejections to the default error handler.
   * This method footprint is laid out as such "(id: string, error: Error)". This
   * @param {string} id - The promise rejection's id.
   * @param {Error} error - The caught rejection.
   */
  processUnhandledRejection(id: string, error: Error) {
    if (__DEV__) {
      console.warn(id, error);
    }

    this.processUnhandledError(error, false);
  }

  /**
   * Format an error into the standard Crash Reporting structure.
   * @param {Error} error - The error to format.
   * @param {StackFrame[]} stackTrace - The errors stacktrace.
   */
  async generateCrashReportPayload(error: Error, stackTrace: StackFrame[]): Promise<CrashReportPayload> {
    const environmentDetails =
      (RaygunNativeBridge.getEnvironmentInfo && (await RaygunNativeBridge.getEnvironmentInfo())) || {};

    // Reformat Native Stack frames to the Raygun StackTrace format
    const convertToCrashReportingStackFrame = ({file, methodName, lineNumber, column}: StackFrame) => ({
      FileName: file,
      MethodName: methodName || '[anonymous]',
      LineNumber: lineNumber,
      ColumnNumber: column,
      ClassName: `line ${lineNumber}, column ${column}`,
    });

    return {
      OccurredOn: new Date(),
      Details: {
        Error: {
          ClassName: error?.name || 'Unknown',
          Message: error?.message || 'Unknown',
          StackTrace: Array.isArray(stackTrace) ?
            stackTrace.map(convertToCrashReportingStackFrame) :
            [convertToCrashReportingStackFrame(stackTrace)],
          StackString: error?.toString() || '',
        },
        Environment: {
          UtcOffset: new Date().getTimezoneOffset() / 60.0,
          ...environmentDetails,
        },
        Client: {
          Name: `raygun4reactnative.${Platform.OS}`,
          Version: clientVersion,
        },
        UserCustomData: this.customData,
        Tags: getCurrentTags(),
        User: getCurrentUser(),
        Breadcrumbs: upperFirst(this.breadcrumbs),
        Version: this.version || 'Not supplied',
      },
    };
  }

  /**
   * Transmit a Crash Report payload to raygun, returning whether or not the transmission is successful.
   * @param {CrashReportPayload} payload
   */
  async sendCrashReport(payload: CrashReportPayload) : Promise<boolean> {
    // Send the message
    try {
      return await fetch(this.raygunCrashReportEndpoint + '?apiKey=' + encodeURIComponent(this.apiKey), {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (response.status === this.RAYGUN_RATE_LIMITING_STATUS_CODE) {
            RaygunLogger.w('Unable to send Crash Report payload:', 'Raygun rate limiting');
            return false;
          }
          return true;
        }).catch((error) => {
          RaygunLogger.e('Unable to send Crash Report payload:', error.message);
          return false;
        });
    } catch (e) {
      return false;
    }
  }
}
