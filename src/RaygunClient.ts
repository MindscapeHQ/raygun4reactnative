import { NativeModules } from 'react-native';
import { Platform } from 'react-native';

const { Rg4rn } = NativeModules;

export interface User {
  identifier: string;
  isAnonymous?: boolean;
  email?: string;
  firstName?: string;
  fullName?: string;
  uuid?: string;
}

export interface Session {
  tags: Set<string>;
  customData: Record<string, any>;
  user: User;
}

interface Stack {
  fileName: string;
  methodName: string;
  lineNumber: number;
  columnNumber: number;
  className: string;
}

export interface StackTrace {
  mode: string;
  name: string;
  stack: Stack[];
  message: string;
  stackRawString: string;
}

let session = {
  tags: new Set(['React Native']),
  customData: {},
  user: {
    identifier: 'anonymous'
  }
};

const init = (options: Record<string, any>) => {
  Rg4rn.init(options); //Enable native side crash reporting
  const prevHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    // TODO: doing RN side error reporting for now, will migrate to Rg4rn.sendMessage once raygun4apple is ready.
    processUnhandledError(error, isFatal);
    prevHandler && prevHandler(error, isFatal);
  });
};

const releasePattern = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|\[native).*?|[^@]*bundle)(?::(\d+))?(?::(\d+))?\s*$/i;
const pathStrip = /^(.*@)?.*\/[^\.]+(\.app|CodePush)\/?(.*)/;
const devPatterns = /.*at\s(.+)(\s*.*)\(http:\/\/.*\/(.*)\?.*:(\d+):(\d+)/i;
const sourceMapPrefix = 'file://reactnative.local/';

const stripNativePaths = (line: string) => {
  const result = pathStrip.exec(line);
  if (result) {
    const [_, func, __, rest] = result;
    return func + sourceMapPrefix + rest;
  }
  return line;
};

const generateStackTrace = (error: Error): StackTrace => {
  const [message, ...traces] = error.stack!.split('\n');
  const stack = traces.map(stripNativePaths).reduce((prev, line) => {
    const results = devPatterns.exec(line) || releasePattern.exec(line);
    if (results) {
      const [_, func, __, url, lineNum, columnNum] = results;
      prev.push({
        fileName: url,
        methodName: func || '[anonymous]',
        lineNumber: +lineNum,
        columnNumber: +columnNum,
        className: `line ${line}, column ${columnNum}`
      });
    }
    return prev;
  }, [] as Stack[]);

  return {
    mode: 'stack',
    name: error.name || '',
    message: error.message || message,
    stack,
    stackRawString: error.toString()
  };
};

const generatePayload = (
  stackTrace: StackTrace,
  tags: string[],
  customData: Record<string, any>,
  user: User,
  version?: string
) => {
  return {
    OccurredOn: new Date(),
    Details: {
      Error: {
        ClassName: stackTrace.name,
        Message: stackTrace.message,
        StackTrace: stackTrace.stack,
        StackString: stackTrace.stackRawString
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
  tags.forEach(session.tags.add);
};

const setUser = (user: User) => {
  session.user = user;
};

const addCustomData = (customData: Record<string, any>) => {
  Object.assign(session.customData, customData);
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

const sendTo = (
  body: string,
  options?: Record<string, any> | undefined
): Promise<any> =>
  fetch('http://localhost:4000/report', {
    method: 'POST',
    mode: 'cors',
    ...options,
    body
  });

const processUnhandledError = async (error: Error, isFatal?: boolean) => {
  if (!error || !error.stack) {
    return;
  }
  const stackTrace = generateStackTrace(error);
  const { tags, customData, user } = session;
  const tagsArray = Array.from(tags.values());
  const payload = generatePayload(
    stackTrace,
    isFatal ? tagsArray.concat('Fatal') : tagsArray,
    customData,
    user
  );
  console.log(payload);
  await sendTo(JSON.stringify(payload), { 'Content-Type': 'application/json' });
};

export default { init, addTag, setUser, addCustomData, clearSession };
