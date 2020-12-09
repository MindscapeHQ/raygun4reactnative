import { NativeModules } from 'react-native';
import { StackFrame } from 'react-native/Libraries/Core/Devtools/parseErrorStack';

const { RaygunNativeBridge } = NativeModules;

//#region ----GENERAL-------------------------------------------------------------------------------

/**
 * Constructs an ID specific for the current device being used.
 */
export const getDeviceBasedId = () =>
  `${RaygunNativeBridge.DEVICE_ID}-${Date.now().toString(32)}-${(Math.random() * 100000)
    .toString(16)
    .replace('.', '')}`;

/**
 * Makes a deep clone of some object.
 * @param object - Object to clone.
 */
export const clone = <T>(object: T): T => JSON.parse(JSON.stringify(object));

//#endregion----------------------------------------------------------------------------------------

//#region ----REGEX REFACTORING---------------------------------------------------------------------

const SOURCE_MAP_PREFIX = 'file://reactnative.local/';

const devicePathPattern = /^(.*@)?.*\/[^\.]+(\.app|CodePush)\/?(.*)/;
const internalTrace = new RegExp('ReactNativeRenderer-dev\\.js$|MessageQueue\\.js$|native\\scode');

/**
 * This method cleans the file paths of the errors logged in a stack trace to be localized to the
 * project. Removing all device specific strings from each path.
 * @param frames - Stack Trace of some error.
 */
export const cleanFilePath = (frames: StackFrame[]): StackFrame[] =>
  frames.map(frame => {
    const result = devicePathPattern.exec(frame.file);
    if (result) {
      const [_, __, ___, fileName] = result;
      return { ...frame, file: SOURCE_MAP_PREFIX + fileName };
    }
    return frame;
  });

/**
 * Ensure a given report data payload uses uppercase keys.
 * @param obj - A report data payload or an array of report data payloads
 */
export const upperFirst = (obj: any | any[]): any | any[] => {
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

/**
 * Remove the '(address at' suffix added by stacktrace-parser which used by React
 * @param frame StackFrame
 */
export const noAddressAt = ({ methodName, ...rest }: StackFrame): StackFrame => {
  const pos = methodName.indexOf('(address at');
  return {
    ...rest,
    methodName: pos > -1 ? methodName.slice(0, pos).trim() : methodName
  };
};

export const removeProtocol = (url: string) => url.replace(/^http(s)?:\/\//i, '');

//-------------------------------------------------------------------------------------------------
// FILTERING
//-------------------------------------------------------------------------------------------------

export const shouldIgnore = (url: string, ignoredURLs: string[]): boolean => {
  const target = removeProtocol(url);
  return ignoredURLs.some(ignored => target.startsWith(ignored));
};

export const filterOutReactFrames = (frame: StackFrame): boolean => !!frame.file && !frame.file.match(internalTrace);

//-------------------------------------------------------------------------------------------------
// LOGGING
//-------------------------------------------------------------------------------------------------

const getLogger = (output: (...args: any[]) => void) => (...args: any[]) => {
  if (__DEV__) {
    output(args);
  }
  return;
};

export const log = getLogger(console.log);

export const warn = getLogger(console.warn);

export const error = getLogger(console.error);
