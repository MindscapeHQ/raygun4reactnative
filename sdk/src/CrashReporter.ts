import {cleanFilePath, filterOutReactFrames, log, noAddressAt, warn} from "./Utils";
import {StackFrame} from "react-native/Libraries/Core/Devtools/parseErrorStack";
import {sendCachedReports, sendCrashReport} from "./Transport";
import {
  BeforeSendHandler,
  Breadcrumb,
  BreadcrumbOption,
  CrashReportPayload,
  CustomData,
  Session
} from "./Types";
import {NativeModules, Platform} from "react-native";
import {clone, upperFirst} from "./Helper";
import {addCustomData, addTag} from "./RaygunClient";

const {RaygunNativeBridge} = NativeModules;
const {version: clientVersion} = require('../package.json');

export default class CrashReporter {

  private curSession: Session;
  private apiKey: string;
  private version: string;
  private disableNativeCrashReporting: boolean;
  private customCrashReportingEndpoint: string;
  private onBeforeSendingCrashReport: BeforeSendHandler | null;

  constructor(curSession: Session, apiKey: string, disableNativeCrashReporting: boolean,
              customCrashReportingEndpoint: string,
              onBeforeSendingCrashReport: BeforeSendHandler | null, version: string) {

    //Setup error handler to divert errors to crash reporter
    let prevHandler = ErrorUtils.getGlobalHandler();

    ErrorUtils.setGlobalHandler(async (error: Error, isFatal?: boolean) => {
      await this.processUnhandledError(error, isFatal);
      prevHandler && prevHandler(error, isFatal);
    });

    //Set up rejection handler to divert rejections to crash reporter
    let rejectionTracking = require('promise/setimmediate/rejection-tracking');
    rejectionTracking.disable();
    rejectionTracking.enable({
      allRejections: true,
      onUnhandled: this.processUnhandledRejection
    });


    if (disableNativeCrashReporting) {
      setTimeout(() => sendCachedReports(apiKey, customCrashReportingEndpoint), 10);
    }

    // Assign the values parsed in (assuming initiation is the only time these are altered).
    this.curSession = curSession;
    this.apiKey = apiKey;
    this.disableNativeCrashReporting = disableNativeCrashReporting;
    this.customCrashReportingEndpoint = customCrashReportingEndpoint;
    this.onBeforeSendingCrashReport = onBeforeSendingCrashReport;
    this.version = version;
  }

  addCustomData(customData: CustomData) {
    this.curSession.customData = Object.assign({}, this.curSession.customData, customData);
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.setCustomData(clone(this.curSession.customData));
    }
  };

  recordBreadcrumb(message: string, details?: BreadcrumbOption) {
    let breadcrumb: Breadcrumb = {
      customData: {},
      category: '',
      level: 'info',
      message, ...details,
      timestamp: new Date().getTime()
    };
    this.curSession.breadcrumbs.push(breadcrumb);
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.recordBreadcrumb(breadcrumb);
    }
  };

  async sendCustomError(error: Error, ...params: any) {
    let [customData, tags] = (params.length == 1 && Array.isArray(params[0])) ? [null, params[0]] : params;
    if (customData) {
      addCustomData(customData as CustomData);
    }
    if (tags && tags.length) {
      addTag(...tags as string[]);
    }
    await this.processUnhandledError(error);
  }

  updateCustomData(updater: (customData: CustomData) => CustomData){
    this.curSession.customData = updater(this.curSession.customData);
    if (!this.disableNativeCrashReporting) {
      RaygunNativeBridge.setCustomData(clone(this.curSession.customData));
    }
  };

  async processUnhandledError(error: Error, isFatal?: boolean) {
    if (!error || !error.stack) {
      warn('Unrecognized error occurred');
      return;
    }

    let parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack');
    let symbolicateStackTrace = require('react-native/Libraries/Core/Devtools/symbolicateStackTrace');
    let stackFrames = parseErrorStack(error);
    let cleanedStackFrames: StackFrame[] = __DEV__
      ? await symbolicateStackTrace(stackFrames)
      : {stack: cleanFilePath(stackFrames)};

    let stack = cleanedStackFrames || [].filter(filterOutReactFrames).map(noAddressAt);

    if (isFatal) {
      this.curSession.tags.add('Fatal');
    }

    let payload = await this.generateCrashReportPayload(error, stack);

    let modifiedPayload =
      this.onBeforeSendingCrashReport && typeof this.onBeforeSendingCrashReport === 'function' ? this.onBeforeSendingCrashReport(Object.freeze(payload)) : payload;

    if (!modifiedPayload) {
      return;
    }

    if (!this.disableNativeCrashReporting) {
      log('Send crash report via Native');
      RaygunNativeBridge.sendCrashReport(JSON.stringify(modifiedPayload), this.apiKey);
      return;
    }

    log('Send crash report via JS');
    sendCrashReport(modifiedPayload, this.apiKey, this.customCrashReportingEndpoint);
  }

  async generateCrashReportPayload(error: Error, stackFrames: StackFrame[]): Promise<CrashReportPayload> {
    let {breadcrumbs, tags, user, customData} = this.curSession;
    let environmentDetails = (RaygunNativeBridge.getEnvironmentInfo && (await RaygunNativeBridge.getEnvironmentInfo())) || {};

    let convertToCrashReportingStackFrame = ({file, methodName, lineNumber, column}: StackFrame) => ({
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
          ClassName: error?.name || '',
          Message: error?.message || '',
          StackTrace: Array.isArray(stackFrames) ? stackFrames.map(convertToCrashReportingStackFrame) : [convertToCrashReportingStackFrame(stackFrames)],
          StackString: error?.toString() || ''
        },
        Environment: {
          UtcOffset: new Date().getTimezoneOffset() / 60.0,
          JailBroken: false,
          ...environmentDetails
        },
        Client: {
          Name: `raygun4reactnative.${Platform.OS}`,
          Version: clientVersion
        },
        UserCustomData: customData,
        Tags: [...tags],
        User: upperFirst(user),
        Breadcrumbs: upperFirst(breadcrumbs),
        Version: this.version || 'Not supplied'
      }
    };
  };

  processUnhandledRejection(error: any) {
    this.processUnhandledError(error, false);
  };
};