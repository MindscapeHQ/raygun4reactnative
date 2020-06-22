import { CrashReportPayload, Breadcrumb, BreadcrumbOption } from 'src/types';
import {
  internalStackFrames,
  stackFramesWithAddress,
  fullStackFrames
} from './fixture/errors';
import { sendCachedReports, sendReport } from '../transport';

jest.mock('react-native', () => ({
  NativeModules: {
    Rg4rn: {
      init: jest.fn(),
      setTags: jest.fn(),
      setUser: jest.fn(),
      setCustomData: jest.fn(),
      recordBreadcrumb: jest.fn()
    }
  },
  Platform: {
    OS: 'ios'
  }
}));

jest.mock('promise/setimmediate/rejection-tracking', () => ({
  disable: jest.fn(),
  enable: jest.fn()
}));

jest.mock('../transport', () => ({
  sendCachedReports: jest.fn(),
  sendReport: jest.fn()
}));

beforeAll(() => {
  global.ErrorUtils = {
    setGlobalHandler: jest.fn() as jest.Mock<any>,
    getGlobalHandler: jest.fn() as jest.Mock<any>
  };
  jest.useFakeTimers();
});

import * as RaygunClient from '../RaygunClient';
import { NativeModules, Platform } from 'react-native';
import { StackFrame } from 'react-native/Libraries/Core/Devtools/parseErrorStack';
const { Rg4rn } = NativeModules;

afterEach(() => {
  RaygunClient.clearSession();
});

describe('RaygunClient Initialization', () => {
  test('should setup error handler on Global ErrorUtils and Promise', () => {
    const rejectTracking = require('promise/setimmediate/rejection-tracking');
    RaygunClient.init({ apiKey: 'someKey' });
    expect(rejectTracking.disable).toBeCalled();
    expect(rejectTracking.enable).toBeCalledWith({
      allRejections: true,
      onUnhandled: expect.any(Function)
    });
    expect(ErrorUtils.setGlobalHandler).toBeCalledWith(expect.any(Function));
  });

  test('should correctly pass apiKey to JS transport when enableNative is false', () => {
    RaygunClient.init({ apiKey: 'someKey', enableNative: false });
    expect(Rg4rn.init).not.toBeCalled();
    jest.runAllTimers();
    expect(sendCachedReports).toBeCalledTimes(1);
    expect(sendCachedReports).toBeCalledWith('someKey', undefined);
  });

  test('should not pass unnecessary options to native side', () => {
    RaygunClient.init({
      apiKey: 'someKey',
      onBeforeSend: (report: CrashReportPayload) => report,
      enableNative: true
    });
    expect(Rg4rn.init).toHaveBeenLastCalledWith({ apiKey: 'someKey' });
  });

  test('should not initialize native side and sendCachedReport from JS side when not enableNative', () => {
    const onBeforeFn = (report: CrashReportPayload) => report;
    RaygunClient.init({
      apiKey: 'someKey',
      onBeforeSend: onBeforeFn,
      enableNative: false
    });
    jest.runAllTimers();
    expect(Rg4rn.init).not.toBeCalled();
    expect(sendCachedReports).toBeCalledTimes(1);
    expect(sendCachedReports).toBeCalledWith('someKey', onBeforeFn);
  });
});

describe('RaygunClient functions', () => {
  test('should pass accumulated tags to backend', () => {
    RaygunClient.addTag('a');
    expect(Rg4rn.setTags).lastCalledWith(['React Native', 'a']);
    RaygunClient.addTag('b', 'c');
    expect(Rg4rn.setTags).lastCalledWith(['React Native', 'a', 'b', 'c']);
  });

  test('should pass customData to backend', () => {
    RaygunClient.addCustomData({ a: '1' });
    expect(Rg4rn.setCustomData).toBeCalledWith({ a: '1' });
    RaygunClient.addCustomData({ b: '2' });
    expect(Rg4rn.setCustomData).toBeCalledWith({ a: '1', b: '2' });
    RaygunClient.updateCustomData(data => ({ val: 'key' }));
    expect(Rg4rn.setCustomData).toBeCalledWith({ val: 'key' });
  });

  test('should pass correct user to backend', () => {
    RaygunClient.setUser('user name');
    expect(Rg4rn.setUser).lastCalledWith({ identifier: 'user name' });
    RaygunClient.setUser('');
    expect(Rg4rn.setUser).lastCalledWith({
      identifier: expect.any(String),
      isAnonymous: true
    });
    const user = {
      identifier: 'id',
      email: 'email',
      firstName: 'first name',
      fullName: 'fullName'
    };
    RaygunClient.setUser(user);
    expect(Rg4rn.setUser).lastCalledWith(user);
  });

  test('should pass correct breadcrumb to backend', () => {
    RaygunClient.recordBreadcrumb('breadcrumbA');
    expect(Rg4rn.recordBreadcrumb).lastCalledWith({ message: 'breadcrumbA' });
    const details: BreadcrumbOption = {
      category: 'bug',
      level: 'info'
    };
    RaygunClient.recordBreadcrumb('breadcrumbB', details);
    expect(Rg4rn.recordBreadcrumb).lastCalledWith({
      message: 'breadcrumbB',
      ...details
    });
  });
});

describe('Error process function', () => {
  test('should filter out react frames', async () => {
    const restFrames = (internalStackFrames as StackFrame[]).filter(
      RaygunClient.filterOutReactFrames
    );
    expect(restFrames).toEqual([
      internalStackFrames[0],
      internalStackFrames[5]
    ]);
  });
  test('should filter out "addressAt" ', async () => {
    const restFrames = (stackFramesWithAddress as StackFrame[]).map(
      RaygunClient.noAddressAt
    );
    expect(restFrames).toEqual([
      { methodName: 'calls' },
      { methodName: 'calls' },
      { methodName: 'calls' }
    ]);
  });

  test('should generate Crash Report payload', async () => {
    const error = new Error('test error message');
    error.name = 'test error name';
    const customData = { key: 'val' };
    const breadcrumb: Breadcrumb = {
      message: 'breadcrumb',
      category: 'category',
      level: 'info',
      customData: { a: '1' }
    };
    const session = {
      tags: new Set(['react-native']),
      user: { identifier: 'mock user' },
      customData: { key: 'val' },
      breadcrumbs: [breadcrumb]
    };
    const payload = RaygunClient.generatePayload(
      error,
      fullStackFrames,
      session
    );
    expect(payload).toEqual({
      OccurredOn: expect.any(Date),
      Details: {
        Environment: {
          UtcOffset: -12
        },
        Error: {
          ClassName: error.name,
          Message: error.message,
          StackTrace: [
            {
              FileName: 'main.jsbundle',
              MethodName: 'call',
              LineNumber: 1,
              ColumnNumber: 42,
              ClassName: 'line 1, column 42'
            },
            {
              FileName: 'main.jsbundle',
              MethodName: 'apply',
              LineNumber: 1,
              ColumnNumber: null,
              ClassName: 'line 1, column null'
            }
          ],
          StackString: expect.any(String)
        },
        Client: {
          Name: `raygun4reactnative.${Platform.OS}`,
          Version: '{{VERSION}}'
        },
        UserCustomData: customData,
        Tags: ['react-native'],
        User: session.user,
        Breadcrumbs: [breadcrumb],
        Version: 'Not supplied'
      }
    });
  });
});
