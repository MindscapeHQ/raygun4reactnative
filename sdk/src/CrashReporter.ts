import {
  cleanFilePath,
  clone,
  error,
  filterOutReactFrames,
  log,
  noAddressAt,
  upperFirst,
  warn
} from "./Utils";
import {StackFrame} from "react-native/Libraries/Core/Devtools/parseErrorStack";
import {
  BeforeSendHandler,
  Breadcrumb,
  BreadcrumbOption,
  CrashReportPayload,
  CustomData,
  Session
} from "./Types";
import {NativeModules, Platform} from "react-native";

const {RaygunNativeBridge} = NativeModules;
const {version: clientVersion} = require('../package.json');

export default class CrashReporter {


  //#region ----INITIALIZATION----------------------------------------------------------------------

  private curSession: Session;
  private breadcrumbs: Breadcrumb[] = [];
  private customData: CustomData = {};
  private apiKey: string;
  private version: string;
  private disableNativeCrashReporting: boolean;
  private customCrashReportingEndpoint: string;
  private onBeforeSendingCrashReport: BeforeSendHandler | null;
  private RAYGUN_CRASH_REPORT_ENDPOINT = 'https://api.raygun.com/entries';

  constructor(curSession: Session,
              apiKey: string,
              disableNativeCrashReporting: boolean,
              customCrashReportingEndpoint: string,
              onBeforeSendingCrashReport: BeforeSendHandler | null,
              version: string) {

    // Assign the values parsed in (assuming initiation is the only time these are altered).
    this.curSession = curSession;
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

    if (disableNativeCrashReporting) {
      setTimeout(() => this.sendCachedReports(apiKey, customCrashReportingEndpoint), 10);
    }
  }

  //#endregion--------------------------------------------------------------------------------------


  //#region ----ALTERING SESSION DATA---------------------------------------------------------------

  addCustomData(customData: CustomData) {
    this.customData = Object.assign({}, this.customData, customData);
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.setCustomData(clone(this.customData));
    }
  };

  updateCustomData(updater: (customData: CustomData) => CustomData) {
    this.customData = updater(this.customData);
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.setCustomData(clone(this.customData));
    }
  };

  recordBreadcrumb(message: string, details?: BreadcrumbOption) {
    const breadcrumb: Breadcrumb = {
      customData: {},
      category: '',
      level: 'info',
      message, ...details,
      timestamp: new Date().getTime()
    };
    this.breadcrumbs.push(breadcrumb);
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.recordBreadcrumb(breadcrumb);
    }
  };

  //#endregion--------------------------------------------------------------------------------------


  //#region ----LOCAL CACHING OF CRASH REPORTS------------------------------------------------------

  async saveCrashReport(report: CrashReportPayload): Promise<null> {
    return RaygunNativeBridge.saveCrashReport(JSON.stringify(report));
  }

  async loadCachedReports(): Promise<CrashReportPayload[]> {
    return RaygunNativeBridge.loadCrashReports().then((reportsJson: string) => {
      try {
        return JSON.parse(reportsJson).filter(Boolean);
      } catch (err) {
        error(err);
        return [];
      }
    });
  }

  async sendCachedReports(apiKey: string, customEndpoint?: string) {
    const reports = await this.loadCachedReports();
    log('Load all cached report', reports);
    return Promise.all(reports.map(report => this.sendCrashReport(report, apiKey, customEndpoint, true)));
  };

  //#endregion--------------------------------------------------------------------------------------


  //#region ----CALLBACK HANDLERS-------------------------------------------------------------------

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
      this.curSession.tags.add('Fatal');
    }

    const payload = await this.generateCrashReportPayload(error, stack);

    const modifiedPayload = (this.onBeforeSendingCrashReport && typeof this.onBeforeSendingCrashReport === 'function')
      ? this.onBeforeSendingCrashReport(Object.freeze(payload))
      : payload;

    if (!modifiedPayload) {
      return;
    }

    if (!this.disableNativeCrashReporting) {
      log('Send crash report via Native');
      RaygunNativeBridge.sendCrashReport(JSON.stringify(modifiedPayload), this.apiKey);
      return;
    }

    log('Send crash report via JS');
    this.sendCrashReport(modifiedPayload, this.apiKey, this.customCrashReportingEndpoint);

  }

  processUnhandledRejection(error: any) {
    this.processUnhandledError(error, false);
  };

  //#endregion--------------------------------------------------------------------------------------


  //#region ----SENDING CRASH REPORTS---------------------------------------------------------------

  async generateCrashReportPayload(error: Error, stackFrames: StackFrame[]): Promise<CrashReportPayload> {
    const {tags, user} = this.curSession;
    const environmentDetails = (RaygunNativeBridge.getEnvironmentInfo && (await RaygunNativeBridge.getEnvironmentInfo())) || {};

    const convertToCrashReportingStackFrame = ({file, methodName, lineNumber, column}: StackFrame) => ({
      FileName: file,
      MethodName: methodName || '[anonymous]',
      LineNumber: lineNumber,
      ColumnNumber: column,
      ClassName: `line ${lineNumber}, column ${column}`
    })

    return {
      OccurredOn: new Date(),
      Details: {
        Error: {
          ClassName: error?.name || 'Unknown',
          Message: error?.message || 'Unknown',
          StackTrace: Array.isArray(stackFrames) ? stackFrames.map(convertToCrashReportingStackFrame) : [convertToCrashReportingStackFrame(stackFrames)],
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
        Tags: [...tags],
        User: upperFirst(user),
        Breadcrumbs: upperFirst(this.breadcrumbs),
        Version: this.version || 'Not supplied'
      }
    };
  };

  resetCrashReporter() {
    this.breadcrumbs = [];
    this.customData = {};
  }

  async sendCrashReport(report: CrashReportPayload, apiKey: string, customEndpoint?: string, isRetry?: boolean) {
    return fetch(customEndpoint || this.RAYGUN_CRASH_REPORT_ENDPOINT + '?apiKey=' + encodeURIComponent(apiKey), {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(report)
    }).catch(err => {
      error(err);
      log('Cache report when it failed to send', isRetry);
      if (isRetry) {
        log('Skip cache saved reports');
        return;
      }
      return this.saveCrashReport(report);
    });
  };

  //#endregion--------------------------------------------------------------------------------------


};
