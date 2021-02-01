import {
  cleanFilePath,
  filterOutReactFrames,
  getCurrentTags,
  getCurrentUser,
  noAddressAt,
  upperFirst,
} from './Utils';
import {
  BeforeSendHandler,
  Breadcrumb,
  CrashReportPayload,
  CustomData,
  ManualCrashReportDetails
} from './Types';
import {StackFrame} from 'react-native/Libraries/Core/Devtools/parseErrorStack';
import {NativeModules, Platform} from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";

const {RaygunNativeBridge} = NativeModules;
const {version: clientVersion} = require('../package.json');

const {polyfillGlobal} = require('react-native/Libraries/Utilities/PolyfillFunctions')
const Promise = require('promise/setimmediate/es6-extensions')
const tracking = require('promise/setimmediate/rejection-tracking')

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
  private onBeforeSendingCrashReport: BeforeSendHandler | null;
  private raygunCrashReportEndpoint = 'https://api.raygun.com/entries';

  private local_storage_key : string = "raygun4reactnative_local_storage";
  private readonly RAYGUN_RATE_LIMITING_STATUS_CODE : number = 429;
  private maxLocallyStoredCrashReports : number = 64;

  /**
   * Initialise Javascript side error/promise rejection handlers and identify whether the Native or
   * Javascript side should be responsible for caching Crash Reports.
   *
   * @param apiKey - Access key for Raygun API
   * @param disableNativeCrashReporting - Whether or not to enable Native side error reporting
   * @param customCrashReportingEndpoint - Custom endpoint for Crash Report (may be empty or null)
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
    this.onBeforeSendingCrashReport = onBeforeSendingCrashReport;
    this.version = version;

    if (customCrashReportingEndpoint && customCrashReportingEndpoint.length > 0) {
      this.raygunCrashReportEndpoint = customCrashReportingEndpoint;
    }

    //Set up error handler to divert errors to crash reporter
    const prevHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler(async (error: Error, isFatal?: boolean) => {
      await this.processUnhandledError(error, isFatal);
      prevHandler && prevHandler(error, isFatal);
    });

    //Set up rejection handler to divert rejections to crash reporter
    polyfillGlobal('Promise', () => {
      tracking.enable({
        allRejections: true,
        onUnhandled: this.processUnhandledRejection.bind(this),
      })

      return Promise
    })

    this.resendCachedReports().then(r => {});
  }

  //#endregion--------------------------------------------------------------------------------------

  //#region ----ALTERING SESSION DATA---------------------------------------------------------------

  /**
   * Append some custom data to the users current set of custom data.
   * @param customData - The custom data to append
   */
  setCustomData(customData: CustomData) {
    this.customData = {...customData};
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.setCustomData({...customData});
    }
  }

  /**
   * Return the custom data as an immutable
   */
  getCustomData() {
    //If this object isnt empty then return it
    for (let prop in this.customData) {
      if (this.customData.hasOwnProperty(prop)) return this.customData;
    }

    return null;
  }

  /**
   * Create and store a new Breadcrumb
   * @param breadcrumb
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
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.clearBreadcrumbs();
    }
  }

  /**
   * Returns the current breadcrumbs.
   */
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  //#endregion--------------------------------------------------------------------------------------

  //#region ----LOCAL CACHING OF CRASH REPORTS------------------------------------------------------

  /**
   * Retrieve and format the local Crash Report cache as a JSON array
   */
  async getCachedCrashReports() : Promise<CrashReportPayload[]>{
    try {
      const rawCache = await AsyncStorage.getItem(this.local_storage_key)
      if(rawCache !== null) {
        try {
          let jsonCache : CrashReportPayload[] = JSON.parse(rawCache);
          return jsonCache;
        }
        catch(e) {
        }
      }
    } catch(e) {
    }
    return [];
  }

  /**
   * Override the local Crash Report cache with a new JSON array
   * @param newCache - the new JSON array to override with
   */
  async setCachedCrashReports(newCache : CrashReportPayload[]) {
    try {
      await AsyncStorage.setItem(this.local_storage_key, JSON.stringify(newCache));
    } catch(e) {
    }
  }

  /**
   * Append a set of Crash Reports to the cache if it isn't already full
   * @param reports - reports to append
   */
  async cacheCrashReports(...reports: CrashReportPayload[]) {
    let appendedCache : CrashReportPayload[] = (await this.getCachedCrashReports()).concat(reports);

    //If the cache is already full then ignore this report
    if (appendedCache.length >= this.maxLocallyStoredCrashReports) {
      appendedCache = appendedCache.slice(0, this.maxLocallyStoredCrashReports);
    }

    await this.setCachedCrashReports(appendedCache);
  }

  /**
   * Attempt to send all cached reports, re-caching any that fail to send
   */
  async resendCachedReports() {
    let cache : CrashReportPayload[] = await this.getCachedCrashReports();
    let reCache : CrashReportPayload[] = [];

    for (let i = 0; i < cache.length; i++) {
      await this.sendCrashReport(cache[i]).then((success) => {
        if (!success) reCache.push(cache[i]);
      });
    }

    this.setCachedCrashReports(reCache);

  }

  /**
   * Set the maximum size of the local cache
   * @param newSize
   */
  async setMaxReportsStoredOnDevice(newSize: number) {
    //Set the maximum keeping between a range of [0, 64]
    this.maxLocallyStoredCrashReports = Math.min(Math.max(newSize, 0), 64)

    //Remove excess cached reports where necessary, prioritising older reports
    let cache : CrashReportPayload[] = await this.getCachedCrashReports();
    if (cache.length > this.maxLocallyStoredCrashReports) {
      await this.setCachedCrashReports(cache.slice(0, this.maxLocallyStoredCrashReports));
    }
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
      return;
    }

    const stack = await this.cleanStackTrace(error);

    const payload = await this.generateCrashReportPayload(error, stack);
    payload.Details.Tags = getCurrentTags().concat("UnhandledError");

    if (isFatal) {
      payload.Details.Tags = getCurrentTags().concat("Fatal");
    }

    this.managePayload(payload);
  }

  /**
   * Processes a manually sent error (using local tags).
   * @param error - The Error to be processed.
   * @param details
   */
  async processManualCrashReport(error: Error, details?: ManualCrashReportDetails) {
    if (!error || !error.stack) {
      return;
    }

    const stack = await this.cleanStackTrace(error);

    const payload = await this.generateCrashReportPayload(error, stack);

    const payloadWithLocalParams: CrashReportPayload = {...payload};

    if(details){
      if(details.customData){
        payloadWithLocalParams.Details.UserCustomData = Object.assign({...this.customData}, details.customData);
      }
      if(details.tags){
        payloadWithLocalParams.Details.Tags = getCurrentTags().concat(details.tags);
      }
    }

    this.managePayload(payloadWithLocalParams);
  }

  /**
   * Cleans the stack trace of some error.
   * @param error - The error to be cleaned.
   */
  async cleanStackTrace(error: Error) {
    //Extract the errors stack trace
    const parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack');
    const stackFrames = parseErrorStack(error);

    //Clean the stack trace and check for empty stack trace
    const symbolicateStackTrace = require('react-native/Libraries/Core/Devtools/symbolicateStackTrace');
    const cleanedStackFrames: StackFrame[] = __DEV__
      ? await symbolicateStackTrace(stackFrames)
      : {stack: cleanFilePath(stackFrames)};

    return cleanedStackFrames || [].filter(filterOutReactFrames).map(noAddressAt);
  }

  /**
   * Modifies and sends the Crash Report Payload (manages beforeSendHandler)
   * @param payload - The payload to send away.
   */
  managePayload(payload: CrashReportPayload) {
    const modifiedPayload =
      this.onBeforeSendingCrashReport && typeof this.onBeforeSendingCrashReport === 'function'
        ? this.onBeforeSendingCrashReport(Object.freeze(payload))
        : payload;

    if (!modifiedPayload) {
      return;
    }

    //Send the Crash Report, caching it if the transmission is not successful
    this.sendCrashReport(modifiedPayload).then((success) => {
      if (!success) this.cacheCrashReports(modifiedPayload);
      else {this.resendCachedReports()}
    });
  }

  /**
   * The promise rejection handler to catch and reroute rejections to the default error handler.
   * This method footprint is laid out as such "(id: string, error: Error)". This
   * @param id - The promise rejection's id
   * @param error - The caught rejection
   */
  processUnhandledRejection(id: string, error: Error) {
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
        User: getCurrentUser(),
        Breadcrumbs: upperFirst(this.breadcrumbs),
        Version: this.version || 'Not supplied'
      }
    };
  }

  /**
   * Transmit a Crash Report payload to raygun, returning whether or not the transmission is successful
   * @param payload
   */
  async sendCrashReport(payload: CrashReportPayload) : Promise<boolean> {
    //Send the message
    try {
      return await fetch(this.raygunCrashReportEndpoint + '?apiKey=' + encodeURIComponent(this.apiKey), {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      .then((response) => {
        if (response.status === this.RAYGUN_RATE_LIMITING_STATUS_CODE) return false
        return true;
      }).catch((error) => {
        return false;
      })
    }
    catch (e) {
      return false;
    }
  }

  //#endregion--------------------------------------------------------------------------------------
}
