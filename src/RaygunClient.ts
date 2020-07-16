import { v4 as uuidv4 } from 'uuid';
import { NativeModules, Platform } from 'react-native';
import { StackFrame } from 'react-native/Libraries/Core/Devtools/parseErrorStack';
//@ts-ignore
const { version: clientVersion } = require('../package.json');
import {
  User,
  Session,
  CrashReportPayload,
  CustomData,
  RaygunClientOptions,
  BreadcrumbOption,
  Breadcrumb
} from './types';
import { sendReport, sendCachedReports } from './transport';

const { Rg4rn } = NativeModules;
const SOURCE_MAP_PREFIX = 'file://reactnative.local/';
const devicePathPattern = /^(.*@)?.*\/[^\.]+(\.app|CodePush)\/?(.*)/;

const getCleanSession = (): Session => ({
  tags: new Set(['React Native']),
  customData: {},
  breadcrumbs: [],
  user: {
    identifier: 'anonymous'
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
let hasReportingServiceRunning = false;

const init = async (options: RaygunClientOptions) => {
  GlobalOptions = Object.assign({ enableNative: true }, options);
  const alreadyInitialized = await Rg4rn.hasInitialized();
  if (alreadyInitialized) {
    console.log('Already initialized');
    return false;
  }

  // Enable native side crash reporting
  if (GlobalOptions.enableNative && Rg4rn && typeof Rg4rn.init === 'function') {
    const { enableNative, onBeforeSend, version, ...rest } = GlobalOptions;
    const resolvedVersion = version || '';
    Rg4rn.init({ ...rest, version: resolvedVersion });
    hasReportingServiceRunning =
      Platform.OS === 'ios' || (await Rg4rn.hasReportingServiceRunning());
  }

  const prevHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler(async (error: Error, isFatal?: boolean) => {
    // TODO: doing RN side error reporting for now, will migrate to Rg4rn.sendMessage once raygun4apple is ready.
    await processUnhandledError(error, isFatal);
    prevHandler && prevHandler(error, isFatal);
  });
  const rejectionTracking = require('promise/setimmediate/rejection-tracking');
  rejectionTracking.disable();
  rejectionTracking.enable({
    allRejections: true,
    onUnhandled: processUnhandledRejection
  });
  if (!GlobalOptions.enableNative) {
    setTimeout(() => sendCachedReports(GlobalOptions.apiKey), 10);
  }
  return true;
};

const internalTrace = new RegExp(
  'ReactNativeRenderer-dev\\.js$|MessageQueue\\.js$|native\\scode'
);

const filterOutReactFrames = (frame: StackFrame): boolean =>
  !!frame.file && !frame.file.match(internalTrace);

/**
 * Remove the '(address at' suffix added by stacktrace-parser which used by React
 * @param frame StackFrame
 */
const noAddressAt = ({ methodName, ...rest }: StackFrame): StackFrame => {
  const pos = methodName.indexOf('(address at');
  return {
    ...rest,
    methodName: pos > -1 ? methodName.slice(0, pos).trim() : methodName
  };
};

const cleanFilePath = (frames: StackFrame[]): StackFrame[] =>
  frames.map(frame => {
    const result = devicePathPattern.exec(frame.file);
    if (result) {
      const [_, __, ___, fileName] = result;
      return { ...frame, file: SOURCE_MAP_PREFIX + fileName };
    }
    return frame;
  });

const generatePayload = async (
  error: Error,
  stackFrames: StackFrame[],
  session: Session
): Promise<CrashReportPayload> => {
  const { breadcrumbs, tags, user, customData } = session;
  const environmentDetails =
    Platform.OS === 'android'
      ? Rg4rn.getEnvironmentInfo && (await Rg4rn.getEnvironmentInfo())
      : {};
  return {
    OccurredOn: new Date(),
    Details: {
      Error: {
        ClassName: error?.name || '',
        Message: error?.message || '',
        StackTrace: stackFrames.map(
          ({ file, methodName, lineNumber, column }) => ({
            FileName: file,
            MethodName: methodName || '[anonymous]',
            LineNumber: lineNumber,
            ColumnNumber: column,
            ClassName: `line ${lineNumber}, column ${column}`
          })
        ),
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
      UserCustomData: customData,
      Tags: [...tags],
      User: upperFirst(user),
      Breadcrumbs: upperFirst(breadcrumbs),
      Version: GlobalOptions.version || 'Not supplied'
    }
  };
};

const addTag = (...tags: string[]) => {
  tags.forEach(tag => {
    curSession.tags.add(tag);
  });
  if (GlobalOptions.enableNative) {
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
            identifier: uuidv4(),
            isAnonymous: true
          }
      : user
  );
  if (GlobalOptions.enableNative) {
    Rg4rn.setUser((curSession.user = userObj));
  }
};

const addCustomData = (customData: CustomData) => {
  curSession.customData = Object.assign({}, curSession.customData, customData);
  Rg4rn.setCustomData(curSession.customData);
};

const updateCustomData = (updater: (customData: CustomData) => CustomData) => {
  curSession.customData = updater(curSession.customData);
  if (GlobalOptions.enableNative) {
    Rg4rn.setCustomData(curSession.customData);
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
  if (GlobalOptions.enableNative) {
    Rg4rn.recordBreadcrumb(breadcrumb);
  }
};

const clearSession = () => {
  curSession = getCleanSession();
};

const processUnhandledRejection = (id: number, error: any) =>
  processUnhandledError(error, false);

const processUnhandledError = async (error: Error, isFatal?: boolean) => {
  if (!error || !error.stack) {
    console.log('Unrecognized error occurred');
    return;
  }
  /** Following two module came from react flow source code, so we require here to prevent TS transpile it */
  const parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack');
  const symbolicateStackTrace = require('react-native/Libraries/Core/Devtools/symbolicateStackTrace');
  const stackFrame = parseErrorStack(error);
  const cleanedStackFrames: StackTrace = __DEV__
    ? await symbolicateStackTrace(stackFrame)
    : { stack: cleanFilePath(stackFrame) };

  const stack =
    cleanedStackFrames.stack ||
    [].filter(filterOutReactFrames).map(noAddressAt);

  if (isFatal) {
    curSession.tags.add('Fatal');
  }

  const payload = await generatePayload(error, stack, curSession);
  const { onBeforeSend } = GlobalOptions;
  const shouldSkip =
    onBeforeSend &&
    typeof onBeforeSend === 'function' &&
    !onBeforeSend(Object.freeze(payload));

  if (shouldSkip) {
    return;
  }

  if (GlobalOptions.enableNative) {
    if (hasReportingServiceRunning) {
      Rg4rn.sendCrashReport(JSON.stringify(payload), GlobalOptions.apiKey);
    } else {
      await sendReport(payload, GlobalOptions.apiKey);
      console.warn(
        'CrashReporting Service not detected, please check the AndroidManifest.xml configuration'
      );
    }
  } else {
    await sendReport(payload, GlobalOptions.apiKey);
  }
};

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
  generatePayload
};
