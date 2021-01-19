import {
  cleanFilePath,
  clone,
  error,
  filterOutReactFrames, getCurrentTags, getCurrentUser,
  log,
  noAddressAt,
  setCurrentTags,
  upperFirst,
  warn
} from './Utils';
import {BeforeSendHandler, Breadcrumb, CrashReportPayload, CustomData, User} from './Types';
import {StackFrame} from 'react-native/Libraries/Core/Devtools/parseErrorStack';
import {NativeModules, Platform} from 'react-native';

const {RaygunNativeBridge} = NativeModules;
const {version: clientVersion} = require('../package.json');

/**
 * The Crash Reporter is responsible for all of the functionality related to generating, catching
 * formatting, caching and transmitting Crash Reports as well as managing users custom data
 * (breadcrumbs and customData).
 */
export default class CrashReporter {
  //#region ----INITIALIZATION----------------------------------------------------------------------

  private breadcrumbs: Breadcrumb[] = [];
  private customData: CustomData = {};
  private apiKey: string;
  private version: string;
  private disableNativeCrashReporting: boolean;
  private customCrashReportingEndpoint: string;
  private onBeforeSendingCrashReport: BeforeSendHandler | null;
  private RAYGUN_CRASH_REPORT_ENDPOINT = 'https://api.raygun.com/entries';

  /**
   * Initialise Javascript side error/promise rejection handlers and identify whether the Native or
   * Javascript side should be responsible for caching Crash Reports.
   *
   * @param apiKey - Access key for Raygun API
   * @param user - A User object that represents the current user.
   * @param tags - A set of strings, where each string is a tag.
   * @param disableNativeCrashReporting - Whether or not to enable Native side error reporting
   * @param customCrashReportingEndpoint - Custom endpoint for crash reports (may be empty or null)
   * @param onBeforeSendingCrashReport - A lambda to execute before each Crash Report transmission
   * @param version - The current version of the RaygunClient
   */
  constructor(
    apiKey: string,
    disableNativeCrashReporting: boolean,
    customCrashReportingEndpoint: string,
    onBeforeSendingCrashReport: BeforeSendHandler | null,
    version: string
  ) {
    // Assign the values parsed in (assuming initiation is the only time these are altered).
    this.apiKey = apiKey;
    this.disableNativeCrashReporting = disableNativeCrashReporting;
    this.customCrashReportingEndpoint = customCrashReportingEndpoint;
    this.onBeforeSendingCrashReport = onBeforeSendingCrashReport;
    this.version = version;

    //Set up error handler to divert errors to crash reporter
    const prevHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler(async (error: Error, isFatal?: boolean) => {
      await this.processUnhandledError(error, isFatal);
      prevHandler && prevHandler(error, isFatal);
    });

    //Set up rejection handler to divert rejections to crash reporter
    const rejectionTracking = require('promise/setimmediate/rejection-tracking');
    rejectionTracking.disable();
    rejectionTracking.enable({
      allRejections: true,
      onUnhandled: this.processUnhandledRejection
    });

    this.resendCachedReports(apiKey, customCrashReportingEndpoint).then(r => {
      log("Cache flushed")
    });
  }

  //#endregion--------------------------------------------------------------------------------------

  //#region ----ALTERING SESSION DATA---------------------------------------------------------------

  /**
   * Append some custom data to the users current set of custom data.
   * @param customData - The custom data to append
   */
  addCustomData(customData: CustomData) {
    this.customData = Object.assign({}, this.customData, customData);
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.setCustomData(clone(this.customData));
    }
  }

  /**
   * Apply some transformation lambda to all of the users custom data
   * @param updater - The transformation
   */
  updateCustomData(updater: (customData: CustomData) => CustomData) {
    this.customData = updater(this.customData);
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.setCustomData(clone(this.customData));
    }
  }

  /**
   * Create and store a new Breadcrumb
   * @param message - A string to describe what this breadcrumb signifies
   * @param details - Details about the breadcrumb
   */
  recordBreadcrumb(breadcrumb: Breadcrumb) {
    this.breadcrumbs.push({...breadcrumb});
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.recordBreadcrumb(breadcrumb);
    }
  }

  /**
   * Removes all breadcrumbs.
   */
  clearBreadcrumbs() {
    this.breadcrumbs = [];
  }

  /**
   * Returns the current breadcrumbs.
   */
  getBreadcrumbs(): Breadcrumb[] {
    return {...this.breadcrumbs};
  }

  //#endregion--------------------------------------------------------------------------------------

  //#region ----LOCAL CACHING OF CRASH REPORTS------------------------------------------------------

  /**
   * Cache a given Report to be sent later.
   * @param report - the Report to cache
   */
  async cacheCrashReport(report: CrashReportPayload): Promise<null> {
    return RaygunNativeBridge.cacheCrashReport(JSON.stringify(report));
  }

  /**
   * Transmit cached reports.
   * @param apiKey - The Raygun application to transmit too
   * @param customEndpoint
   */
  async resendCachedReports(apiKey: string, customEndpoint?: string) {

    //If there are Reports cached
    if (!await RaygunNativeBridge.cacheEmpty()) {
      //Extract cached reports from the native side
      const cache: CrashReportPayload[] = await RaygunNativeBridge.flushCrashReportCache()
      .then((reportsJson: string) => {
        try {
          //Format the cache and remove empty and null strings
          return JSON.parse(reportsJson).filter(Boolean) as CrashReportPayload[];
        } catch (err) {
          //If there are no cached reports then return an empty array
          error(err);
          return [];
        }
      });

      log('Cache flushed', cache);

      //Attempt to send each of the cached reports
      await Promise.all(cache.map(cachedReport => this.sendCrashReport(cachedReport, apiKey, customEndpoint)));
    }
  }

  /**
   * Change the size of the local cache
   * @param size - The new cache size, must be between 0 and 64
   */
  async setMaxReportsStoredOnDevice(size: number) {
    RaygunNativeBridge.setMaxReportsStoredOnDevice(size);
  }

  //#endregion--------------------------------------------------------------------------------------

  //#region ----CALLBACK HANDLERS-------------------------------------------------------------------

  /**
   * The error handler method to catch react errors and route them to the CrashReporter.
   * @param error - The caught error
   * @param isFatal - Whether or not the error was fatal
   */
  async processUnhandledError(error: Error, isFatal?: boolean) {
    if (!error || !error.stack) {
      warn('Unrecognized error occurred');
      return;
    }

    //Extract the errors stack trace
    const parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack');
    const stackFrames = parseErrorStack(error);

    //Clean the stack trace and check for empty stack trace
    const symbolicateStackTrace = require('react-native/Libraries/Core/Devtools/symbolicateStackTrace');
    const cleanedStackFrames: StackFrame[] = __DEV__
      ? await symbolicateStackTrace(stackFrames)
      : {stack: cleanFilePath(stackFrames)};

    const stack = cleanedStackFrames || [].filter(filterOutReactFrames).map(noAddressAt);

    if (isFatal) {
      setCurrentTags(getCurrentTags().concat('UnhandledError'))
    }

    const payload = await this.generateCrashReportPayload(error, stack);

    const modifiedPayload =
      this.onBeforeSendingCrashReport && typeof this.onBeforeSendingCrashReport === 'function'
        ? this.onBeforeSendingCrashReport(Object.freeze(payload))
        : payload;

    if (!modifiedPayload) {
      return;
    }

    log('Send crash report via JS');
    this.sendCrashReport(modifiedPayload, this.apiKey, this.customCrashReportingEndpoint);
  }

  /**
   * the promise rejection handler to catch and reroute rejections to the default error handler.
   * @param error - the caught rejection
   */
  processUnhandledRejection(error: any) {
    this.processUnhandledError(error, false);
  }

  //#endregion--------------------------------------------------------------------------------------

  //#region ----SENDING CRASH REPORTS---------------------------------------------------------------

  /**
   * Format an error into the standard Crash Reporting structure.
   * @param error - The error to format
   * @param stackTrace - The errors stacktrace
   */
  async generateCrashReportPayload(error: Error, stackTrace: StackFrame[]): Promise<CrashReportPayload> {
    const environmentDetails =
      (RaygunNativeBridge.getEnvironmentInfo && (await RaygunNativeBridge.getEnvironmentInfo())) || {};

    //Reformat Native Stack frames to the Raygun StackTrace format.
    const convertToCrashReportingStackFrame = ({file, methodName, lineNumber, column}: StackFrame) => ({
      FileName: file,
      MethodName: methodName || '[anonymous]',
      LineNumber: lineNumber,
      ColumnNumber: column,
      ClassName: `line ${lineNumber}, column ${column}`
    });

    return {
      OccurredOn: new Date(),
      Details: {
        Error: {
          ClassName: error?.name || 'Unknown',
          Message: error?.message || 'Unknown',
          StackTrace: Array.isArray(stackTrace)
            ? stackTrace.map(convertToCrashReportingStackFrame)
            : [convertToCrashReportingStackFrame(stackTrace)],
          StackString: error?.toString() || ''
        },
        Environment: {
          UtcOffset: new Date().getTimezoneOffset() / 60.0,
          ...environmentDetails
        },
        Client: {
          Name: `raygun4reactnative.${Platform.OS}`,
          Version: clientVersion
        },
        UserCustomData: this.customData,
        Tags: getCurrentTags(),
        User: upperFirst(getCurrentUser()),
        Breadcrumbs: upperFirst(this.breadcrumbs),
        Version: this.version || 'Not supplied'
      }
    };
  }

  /**
   * Clear all custom user data
   */
  resetCrashReporter() {
    this.breadcrumbs = [];
    this.customData = {};
  }

  /**
   * Output a CrashReportPayload to Raygun or a custom endpoint
   * @param report
   * @param apiKey
   * @param customEndpoint
   * @param isAlreadyCached
   */
  async sendCrashReport(
    report: CrashReportPayload,
    apiKey: string,
    customEndpoint?: string
  ) {
    //Send the message
    return fetch(customEndpoint || this.RAYGUN_CRASH_REPORT_ENDPOINT + '?apiKey=' + encodeURIComponent(apiKey), {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(report)
    }).then(() => {
      //If the message is successfully sent then attempt to transmit the cache if it isn't empty
      this.resendCachedReports(apiKey, this.customCrashReportingEndpoint).then(r => {
        log("Cache flushed")
      });
    })
    .catch(err => {
      //If there are any errors then
      error(err);
      return this.cacheCrashReport(report);
    });
  }

  //#endregion--------------------------------------------------------------------------------------
}
