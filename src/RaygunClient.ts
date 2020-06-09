import { v4 as uuidv4 } from 'uuid';
import { NativeModules, Platform } from 'react-native';
import { StackFrame } from 'react-native/Libraries/Core/Devtools/parseErrorStack';
import { User, Session, CrashReportPayload, CustomData } from './types';
import { sendReport, sendCachedReports } from './transport';

const { Rg4rn } = NativeModules;
const SOURCE_MAP_PREFIX = 'file://reactnative.local/';
const devicePathPattern = /^(.*@)?.*\/[^\.]+(\.app|CodePush)\/?(.*)/;

let session: Session = {
  tags: new Set(['React Native']),
  customData: {},
  user: {
    identifier: 'anonymous'
  }
};

let resolvedOptions: Record<string, any> = {};

const init = (options: Record<string, any>) => {
  // Enable native side crash reporting
  if (Rg4rn && typeof Rg4rn.init === 'function') {
    Rg4rn.init(options);
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
    onUnhandled: processUnhandledError
  });
  setTimeout(() => sendCachedReports(options.apiKey), 10);
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

const generatePayload = (
  error: Error,
  stackFrames: StackFrame[],
  tags: string[],
  customData: Record<string, any>,
  user: User,
  version?: string
): CrashReportPayload => {
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
        UtcOffset: new Date().getTimezoneOffset() / 60.0
        //TODO: adds RN environment infos
      },
      Client: {
        Name: `raygun4reactnative.${Platform.OS}`,
        Version: '{{VERSION}}'
      },
      UserCustomData: customData,
      Tags: tags,
      User: user,
      Version: version || 'Not supplied'
    }
  };
};

const addTag = (...tags: string[]) => {
  tags.forEach(tag => {
    session.tags.add(tag);
    if (Platform.OS === 'android') {
      Rg4rn.addTag(tag);
    }
  });
};

const setUser = (user: User | string) => {
  session.user =
    typeof user === 'string'
      ? !!user
        ? { identifier: user }
        : { identifier: uuidv4(), isAnonymous: true }
      : user;
};

const addCustomData = (customData: CustomData) => {
  Object.assign(session.customData, customData);
};

const updateCustomData = (updater: (customData: CustomData) => CustomData) => {
  session.customData = updater(session.customData);
};

const clearSession = () => {
  session = {
    tags: new Set(['React Native']),
    customData: {},
    user: {
      identifier: 'anonymous'
    }
  };
};

const remoteLog = (
  body: string | object,
  options?: Record<string, any> | undefined
): Promise<any> =>
  fetch('http://localhost:4000/report', {
    method: 'POST',
    mode: 'cors',
    ...options,
    body: typeof body === 'object' ? JSON.stringify(body) : body,
    ...(typeof body === 'object' && {
      headers: { 'Content-Type': 'application/json' }
    })
  });

const processUnhandledError = async (error: Error, isFatal?: boolean) => {
  if (!error || !error.stack) {
    return;
  }

  const parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack');
  const stackFrame = parseErrorStack(error);

  const symbolicateStackTrace = require('react-native/Libraries/Core/Devtools/symbolicateStackTrace');

  const symbolicatedTrace = __DEV__
    ? await symbolicateStackTrace(stackFrame)
    : { stack: cleanFilePath(stackFrame) };

  const stack = symbolicatedTrace.stack
    .filter(filterOutReactFrames)
    .map(noAddressAt);

  const { tags, customData, user } = session;

  const tagsArray = Array.from(tags.values());
  const payload = generatePayload(
    error,
    stack,
    isFatal ? tagsArray.concat('Fatal') : tagsArray,
    customData,
    user
  );

  await sendReport(payload, resolvedOptions.apiKey);
};

export default {
  init,
  addTag,
  setUser,
  addCustomData,
  clearSession,
  updateCustomData
};
