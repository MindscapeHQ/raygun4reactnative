import { NativeModules } from 'react-native';
import { StackFrame } from 'react-native/Libraries/Core/Devtools/parseErrorStack';
const { Rg4rn } = NativeModules;

const SOURCE_MAP_PREFIX = 'file://reactnative.local/';
const devicePathPattern = /^(.*@)?.*\/[^\.]+(\.app|CodePush)\/?(.*)/;

export const getDeviceBasedId = () =>
  `${Rg4rn.DEVICE_ID}-${Date.now().toString(32)}-${(Math.random() * 100000).toString(16).replace('.', '')}`;

const internalTrace = new RegExp('ReactNativeRenderer-dev\\.js$|MessageQueue\\.js$|native\\scode');

export const filterOutReactFrames = (frame: StackFrame): boolean => !!frame.file && !frame.file.match(internalTrace);

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

export const cleanFilePath = (frames: StackFrame[]): StackFrame[] =>
  frames.map(frame => {
    const result = devicePathPattern.exec(frame.file);
    if (result) {
      const [_, __, ___, fileName] = result;
      return { ...frame, file: SOURCE_MAP_PREFIX + fileName };
    }
    return frame;
  });

const getLogger = (output: (...args: any[]) => void) => (...args: any[]) => {
  if (process.env.DEBUG) {
    output(args);
  }
  return;
};

export const log = getLogger(console.log);

export const warn = getLogger(console.warn);

export const error = getLogger(console.error);
