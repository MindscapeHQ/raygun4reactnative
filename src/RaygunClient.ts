import { NativeModules, Platform } from 'react-native';
import { StackFrame } from 'react-native/Libraries/Core/Devtools/parseErrorStack';
import { getDeviceBasedId, filterOutReactFrames, cleanFilePath, noAddressAt, log, warn } from './utils';
//@ts-ignore
const { version: clientVersion } = require('../package.json');
import {
  User,
  Session,
  CrashReportPayload,
  CustomData,
  RaygunClientOptions,
  BreadcrumbOption,
  Breadcrumb,
  RUMEvents
} from './types';
import { sendCustomRUMEvent, setupRealtimeUserMonitoring } from './realtime-user-monitor';
import { sendCrashReport, sendCachedReports } from './transport';

const { Rg4rn } = NativeModules;

const clone = <T>(object: T): T => JSON.parse(JSON.stringify(object));

const getCleanSession = (): Session => ({
  tags: new Set(['React Native']),
  customData: {},
  breadcrumbs: [],
  user: {
    identifier: `anonymous-${getDeviceBasedId()}`
  }
});

const upperFirst = (obj: any | any[]): any | any[] => {
  if (Array.isArray(obj)) {
    return obj.map(upperFirst);
  }
  if (typeof obj === 'object') {
    return Object.entries(obj).reduce(
      (all, [key, val]) => ({
        ...all,
        ...(key !== 'customData'
          ? { [key.slice(0, 1).toUpperCase() + key.slice(1)]: upperFirst(val) }
          : { CustomData: val })
      }),
      {}
    );
  }
  return obj;
};

interface StackTrace {
  stack: StackFrame[];
}

let curSession = getCleanSession();
let GlobalOptions: RaygunClientOptions;

const getCurrentUser = () => curSession.user;

const init = async (options: RaygunClientOptions) => {
  GlobalOptions = Object.assign(
    {
      enableNetworkMonitoring: true,
      enableNativeCrashReporting: true,
      enableRUM: true,
      ignoreURLs: [],
      version: '',
      apiKey: ''
    },
    options
  );

  const useNativeCR = GlobalOptions.enableNativeCrashReporting && Rg4rn && typeof Rg4rn.init === 'function';

  const alreadyInitialized = useNativeCR && (await Rg4rn.hasInitialized());
  if (alreadyInitialized) {
    log('Already initialized');
    return false;
  }

  const { version: appVersion, enableRUM, ignoreURLs, enableNetworkMonitoring, apiKey } = GlobalOptions;

  if (enableRUM) {
    setupRealtimeUserMonitoring(
      getCurrentUser,
      apiKey,
      enableNetworkMonitoring,
      ignoreURLs,
      GlobalOptions.customRUMEndpoint
    );
  }

  if (useNativeCR || enableRUM) {
    Rg4rn.init({ apiKey, enableRUM, version: appVersion || '' });
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
    setTimeout(() => sendCachedReports(GlobalOptions.apiKey, GlobalOptions.customCrashReportingEndpoint), 10);
  }
  return true;
};

const generatePayload = async (
  error: Error,
  stackFrames: StackFrame[],
  session: Session
): Promise<CrashReportPayload> => {
  const { breadcrumbs, tags, user, customData } = session;
  const environmentDetails = (Rg4rn.getEnvironmentInfo && (await Rg4rn.getEnvironmentInfo())) || {};
  return {
    OccurredOn: new Date(),
    Details: {
      Error: {
        ClassName: error?.name || '',
        Message: error?.message || '',
        StackTrace: stackFrames.map(({ file, methodName, lineNumber, column }) => ({
          FileName: file,
          MethodName: methodName || '[anonymous]',
          LineNumber: lineNumber,
          ColumnNumber: column,
          ClassName: `line ${lineNumber}, column ${column}`
        })),
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
  if (!GlobalOptions.enableRUM) {
    warn('RUM is not enabled, please enable to use the sendRUMTimingEvent() function');
    return;
  }
  sendCustomRUMEvent(
    getCurrentUser,
    GlobalOptions.apiKey,
    eventType,
    name,
    timeUsedInMs,
    GlobalOptions.customRUMEndpoint
  );
};

const addTag = (...tags: string[]) => {
  tags.forEach(tag => {
    curSession.tags.add(tag);
  });
  if (GlobalOptions.enableNativeCrashReporting) {
    Rg4rn.setTags([...curSession.tags]);
  }
};

const setUser = (user: User | string) => {
  const userObj = Object.assign(
    { firstName: '', fullName: '', email: '', isAnonymous: false },
    typeof user === 'string'
      ? !!user
        ? {
            identifier: user
          }
        : {
            identifier: `anonymous-${getDeviceBasedId()}`,
            isAnonymous: true
          }
      : user
  );
  curSession.user = userObj;
  if (GlobalOptions.enableNativeCrashReporting) {
    Rg4rn.setUser(userObj);
  }
};

const addCustomData = (customData: CustomData) => {
  curSession.customData = Object.assign({}, curSession.customData, customData);
  if (GlobalOptions.enableNativeCrashReporting) {
    Rg4rn.setCustomData(clone(curSession.customData));
  }
};

const updateCustomData = (updater: (customData: CustomData) => CustomData) => {
  curSession.customData = updater(curSession.customData);
  if (GlobalOptions.enableNativeCrashReporting) {
    Rg4rn.setCustomData(clone(curSession.customData));
  }
};

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
  if (GlobalOptions.enableNativeCrashReporting) {
    Rg4rn.recordBreadcrumb(breadcrumb);
  }
};

const clearSession = () => {
  curSession = getCleanSession();
  if (GlobalOptions.enableNativeCrashReporting) {
    Rg4rn.clearSession();
  }
};

const processUnhandledRejection = (id: number, error: any) => processUnhandledError(error, false);

const processUnhandledError = async (error: Error, isFatal?: boolean) => {
  if (!error || !error.stack) {
    warn('Unrecognized error occurred');
    return;
  }

  const parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack');
  const symbolicateStackTrace = require('react-native/Libraries/Core/Devtools/symbolicateStackTrace');
  const stackFrame = parseErrorStack(error);
  const cleanedStackFrames: StackTrace = __DEV__
    ? await symbolicateStackTrace(stackFrame)
    : { stack: cleanFilePath(stackFrame) };

  const stack = cleanedStackFrames.stack || [].filter(filterOutReactFrames).map(noAddressAt);

  if (isFatal) {
    curSession.tags.add('Fatal');
  }

  const payload = await generatePayload(error, stack, curSession);
  const { onBeforeSend } = GlobalOptions;
  const modifiedPayload =
    onBeforeSend && typeof onBeforeSend === 'function' ? onBeforeSend(Object.freeze(payload)) : payload;

  if (!modifiedPayload) {
    return;
  }

  if (GlobalOptions.enableNativeCrashReporting) {
    log('Send crash report via Native');
    Rg4rn.sendCrashReport(JSON.stringify(modifiedPayload), GlobalOptions.apiKey);
    return;
  }

  log('Send crash report via JS');
  sendCrashReport(modifiedPayload, GlobalOptions.apiKey, GlobalOptions.customCrashReportingEndpoint);
};

const sendCustomError = processUnhandledError;

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
  generatePayload,
  sendRUMTimingEvent,
  sendCustomError
};
