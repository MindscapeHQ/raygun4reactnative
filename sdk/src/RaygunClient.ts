import { NativeModules, Platform } from 'react-native';
import { StackFrame } from 'react-native/Libraries/Core/Devtools/parseErrorStack';
import { getDeviceBasedId, filterOutReactFrames, cleanFilePath, noAddressAt, log, warn } from './Utils';
import {
  User,
  Session,
  CrashReportPayload,
  CustomData,
  RaygunClientOptions,
  BreadcrumbOption,
  Breadcrumb,
  RUMEvents,
  SendCustomErrorOverload
} from './Types';
import { sendCustomRUMEvent, setupRealtimeUserMonitoring } from './RealUserMonitoring';
import { sendCrashReport, sendCachedReports } from './Transport';
import {clone, upperFirst} from "./Helper";

//@ts-ignore
const { version: clientVersion } = require('../package.json');

const { RaygunNativeBridge } = NativeModules;

const getCleanSession = (): Session => ({
  tags: new Set(['React Native']),
  customData: {},
  breadcrumbs: [],
  user: {
    identifier: `anonymous-${getDeviceBasedId()}`
  }
});

let curSession = getCleanSession();
let GlobalOptions: RaygunClientOptions;

const getCurrentUser = () => curSession.user;

const init = async (options: RaygunClientOptions) => {
  GlobalOptions = Object.assign(
      {
        disableNetworkMonitoring: false,
        disableNativeCrashReporting: false,
        enableRealUserMonitoring: true,
        ignoredURLs: [],
        version: '',
        apiKey: ''
      },
      options
  );

  const useNativeCR = !GlobalOptions.disableNativeCrashReporting && RaygunNativeBridge && typeof RaygunNativeBridge.init === 'function';

  const alreadyInitialized = useNativeCR && (await RaygunNativeBridge.hasInitialized());
  if (alreadyInitialized) {
    log('Already initialized');
    return false;
  }

  const {
    version: appVersion,
    enableRealUserMonitoring,
    ignoredURLs,
    disableNetworkMonitoring,
    apiKey,
    customCrashReportingEndpoint,
    customRealUserMonitoringEndpoint
  } = GlobalOptions;

  if (enableRealUserMonitoring) {
    setupRealtimeUserMonitoring(getCurrentUser, apiKey, disableNetworkMonitoring, ignoredURLs, customRealUserMonitoringEndpoint);
  }

  if (useNativeCR || enableRealUserMonitoring) {
    RaygunNativeBridge.init({ apiKey, enableRealUserMonitoring, version: appVersion || '', customCrashReportingEndpoint });
  }

  const prevHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler(async (error: Error, isFatal?: boolean) => {
    await processUnhandledError(error, isFatal);
    prevHandler && prevHandler(error, isFatal);
  });

  const rejectionTracking = require('promise/setimmediate/rejection-tracking');
  rejectionTracking.disable();
  rejectionTracking.enable({
    allRejections: true,
    onUnhandled: processUnhandledRejection
  });
  if (!useNativeCR) {
    setTimeout(() => sendCachedReports(GlobalOptions.apiKey, customCrashReportingEndpoint), 10);
  }
  return true;
};


//MEEEEEEEEEEEEEEEEEEEEEEEEE
const generateCrashReportPayload = async (
    error: Error,
    stackFrames: StackFrame[],
    session: Session
): Promise<CrashReportPayload> => {
  const { breadcrumbs, tags, user, customData } = session;
  const environmentDetails = (RaygunNativeBridge.getEnvironmentInfo && (await RaygunNativeBridge.getEnvironmentInfo())) || {};

  let convertToCrashReportingStackFrame =  ({ file, methodName, lineNumber, column } : StackFrame) => ({
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
      Version: GlobalOptions.version || 'Not supplied'
    }
  };
};


const sendRUMTimingEvent = (
    eventType: RUMEvents.ActivityLoaded | RUMEvents.NetworkCall,
    name: string,
    timeUsedInMs: number
) => {
  if (!GlobalOptions.enableRealUserMonitoring) {
    warn('RUM is not enabled, please enable to use the sendRUMTimingEvent() function');
    return;
  }
  sendCustomRUMEvent(
      getCurrentUser,
      GlobalOptions.apiKey,
      eventType,
      name,
      timeUsedInMs,
      GlobalOptions.customRealUserMonitoringEndpoint
  );
};




const addTag = (...tags: string[]) => {
  tags.forEach(tag => {
    curSession.tags.add(tag);
  });
  if (!GlobalOptions.disableNativeCrashReporting) {
    RaygunNativeBridge.setTags([...curSession.tags]);
  }
};


const setUser = (user: User | string) => {
  const userObj = Object.assign(
      { firstName: '', fullName: '', email: '', isAnonymous: false },
      typeof user === 'string'
          ? !!user ? {identifier: user}
                   : {identifier: `anonymous-${getDeviceBasedId()}`,isAnonymous: true} : user
  );
  curSession.user = userObj;
  if (!GlobalOptions.disableNativeCrashReporting) {
    RaygunNativeBridge.setUser(userObj);
  }
};


//MEEEEEEEEEEEEEEEEEEEEEEEEE
const addCustomData = (customData: CustomData) => {
  curSession.customData = Object.assign({}, curSession.customData, customData);
  if (!GlobalOptions.disableNativeCrashReporting) {
    RaygunNativeBridge.setCustomData(clone(curSession.customData));
  }
};

//???????????????????????????
const updateCustomData = (updater: (customData: CustomData) => CustomData) => {
  curSession.customData = updater(curSession.customData);
  if (!GlobalOptions.disableNativeCrashReporting) {
    RaygunNativeBridge.setCustomData(clone(curSession.customData));
  }
};

//MEEEEEEEEEEEEEEEEEEEEEEEEE
const recordBreadcrumb = (message: string, details?: BreadcrumbOption) => {
  const breadcrumb: Breadcrumb = {
    customData: {},
    category: '',
    level: 'info',
    message,
    ...details,
    timestamp: new Date().getTime()
  };
  curSession.breadcrumbs.push(breadcrumb);
  if (!GlobalOptions.disableNativeCrashReporting) {
    RaygunNativeBridge.recordBreadcrumb(breadcrumb);
  }
};

const clearSession = () => {
  curSession = getCleanSession();
  if (!GlobalOptions.disableNativeCrashReporting) {
    RaygunNativeBridge.clearSession();
  }
};

//MEEEEEEEEEEEEEEEEEEEEEEEEE
const processUnhandledRejection = (id: number, error: any) => processUnhandledError(error, false);

//MEEEEEEEEEEEEEEEEEEEEEEEEE
const processUnhandledError = async (error: Error, isFatal?: boolean) => {
  if (!error || !error.stack) {
    warn('Unrecognized error occurred');
    return;
  }

  const parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack');
  const symbolicateStackTrace = require('react-native/Libraries/Core/Devtools/symbolicateStackTrace');
  const stackFrame = parseErrorStack(error);
  const cleanedStackFrames: StackFrame[] = __DEV__
      ? await symbolicateStackTrace(stackFrame)
      : { stack: cleanFilePath(stackFrame) };

  const stack = cleanedStackFrames || [].filter(filterOutReactFrames).map(noAddressAt);

  if (isFatal) {
    curSession.tags.add('Fatal');
  }

  const payload = await generateCrashReportPayload(error, stack, curSession);

  const { onBeforeSendingCrashReport } = GlobalOptions;
  const modifiedPayload =
      onBeforeSendingCrashReport && typeof onBeforeSendingCrashReport === 'function' ? onBeforeSendingCrashReport(Object.freeze(payload)) : payload;

  if (!modifiedPayload) {
    return;
  }

  if (!GlobalOptions.disableNativeCrashReporting) {
    log('Send crash report via Native');
    RaygunNativeBridge.sendCrashReport(JSON.stringify(modifiedPayload), GlobalOptions.apiKey);
    return;
  }

  log('Send crash report via JS');
  sendCrashReport(modifiedPayload, GlobalOptions.apiKey, GlobalOptions.customCrashReportingEndpoint);
};


//MEEEEEEEEEEEEEEEEEEEEEEEEE
const sendCustomError:SendCustomErrorOverload  = async (error: Error, ...params: any) => {
  const [customData, tags] = params.length == 1 && Array.isArray(params[0]) ? [null, params[0]] : params;
  if (customData) {
    addCustomData(customData as CustomData);
  }
  if (tags && tags.length) {
    addTag(...tags as string[]);
  }
  await processUnhandledError(error);
}



export {
  init,
  addTag,
  setUser,
  addCustomData,
  clearSession,
  updateCustomData,
  recordBreadcrumb,
  filterOutReactFrames,
  noAddressAt,
  generateCrashReportPayload,
  sendRUMTimingEvent,
  sendCustomError
};
