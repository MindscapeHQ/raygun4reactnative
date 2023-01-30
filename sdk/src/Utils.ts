import {StackFrame} from 'react-native/Libraries/Core/Devtools/parseErrorStack';
import {NativeModules} from 'react-native';
import {User} from './Types';

const {RaygunNativeBridge} = NativeModules;

/**
 * @return {string} Constructs an ID specific for the current device being used.
 */
export const getDeviceId = () => `${RaygunNativeBridge.DEVICE_ID}`;

/**
 * The Anonymous user object
 */
export const anonUser: User = {
  identifier: `${getDeviceId()}`,
  isAnonymous: true,
};

/**
 * Produce a random identifier of a certain length.
 * @param {number} length - The number of characters the returned string must not exceed.
 * @return {string} A unique GUID.
 */
export const getRandomGUID = (length: number) => {
  // 1.) n = 36^(l+1) - ([0.0, 1.0] * 36^l)
  // 2.) n = convertToBase36(n.roundToWholeNumber())
  // 3.) n = n.removeFirstCharacter
  return Math.round(Math.pow(36, length + 1) - Math.random() * Math.pow(36, length))
    .toString(36)
    .slice(1);
};

let currentUser: User = anonUser;
let currentTags: string[] = [];

export const setCurrentUser = (newUser: User) => {
  currentUser = {...newUser};
};

export const getCurrentUser = (): User => {
  if (!currentUser) currentUser = {...anonUser};
  return {...currentUser};
};

export const setCurrentTags = (newTags: string[]) => {
  currentTags = [...newTags];
};

export const getCurrentTags = (): string[] => {
  return [...currentTags];
};

const SOURCE_MAP_PREFIX = 'file://reactnative.local/';

const devicePathPattern = /^(.*@)?.*\/[^\.]+(\.app|CodePush)\/?(.*)/;
const internalTrace = new RegExp('ReactNativeRenderer-dev\\.js$|MessageQueue\\.js$|native\\scode');

/**
 * This method cleans the file paths of the errors logged in a stack trace to be localized to the
 * project. Removing all device specific strings from each path.
 * @param {StackFrame[]} frames - Stack Trace of some error.
 * @return {StackFrame[]} A set of stack frames.
 */
export const cleanFilePath = (frames: StackFrame[]): StackFrame[] =>
  frames.map((frame) => {
    const result = devicePathPattern.exec(frame.file);
    if (result) {
      const [_, __, ___, fileName] = result;
      return {...frame, file: SOURCE_MAP_PREFIX + fileName};
    }
    return frame;
  });

/**
 * Ensure a given report data payload uses uppercase keys.
 * @param {(any|any[])} obj - A report data payload or an array of report data payloads.
 * @return {(any|any[])} A report data payload or an array of report data payloads.
 */
export const upperFirst = (obj: any | any[]): any | any[] => {
  if (Array.isArray(obj)) {
    return obj.map(upperFirst);
  }
  if (typeof obj === 'object') {
    return Object.entries(obj).reduce(
      (all, [key, val]) => ({
        ...all,
        ...(key !== 'customData' ?
          {[key.slice(0, 1).toUpperCase() + key.slice(1)]: upperFirst(val)} :
          {CustomData: val}),
      }),
      {},
    );
  }
  return obj;
};

/**
 * Remove the '(address at' suffix added by stacktrace-parser which used by React.
 * @param {StackFrame} frame - The stack frame.
 * @return {StackFrame} The stack frame.
 */
export const noAddressAt = ({methodName, ...rest}: StackFrame): StackFrame => {
  const pos = methodName.indexOf('(address at');
  return {
    ...rest,
    methodName: pos > -1 ? methodName.slice(0, pos).trim() : methodName,
  };
};

export const filterOutReactFrames = (frame: StackFrame): boolean => !!frame.file && !frame.file.match(internalTrace);

export const cleanFields = (obj: any): any => {
  return Object.entries(obj)
    .filter(([_, v]) => v != null)
    .reduce((acc, [k, v]) => ({...acc, [k]: v}), {});
}
