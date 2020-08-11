import { CrashReportPayload, Breadcrumb, BreadcrumbOption } from '../types';
import { internalStackFrames, stackFramesWithAddress, fullStackFrames } from './fixture/errors';
import { sendCachedReports, sendCrashReport } from '../transport';

jest.mock('../network-monitor', () => ({
  setupNetworkMonitoring: jest.fn()
}));

jest.mock('react-native', () => ({
  NativeModules: {
    Rg4rn: {
      init: jest.fn(),
      setTags: jest.fn(),
      setUser: jest.fn(),
      setCustomData: jest.fn(),
      recordBreadcrumb: jest.fn(),
      hasInitialized: jest.fn().mockResolvedValue(false),
      getEnvironmentInfo: jest.fn().mockResolvedValue({}),
      hasCrashReportingServiceRunning: jest.fn().mockResolvedValue(true),
      hasRUMPostServiceRunning: jest.fn()
    }
  },
  Platform: {
    OS: ''
  }
}));

jest.mock('promise/setimmediate/rejection-tracking', () => ({
  disable: jest.fn(),
  enable: jest.fn()
}));

jest.mock('../transport', () => ({
  sendCachedReports: jest.fn(),
  sendCrashReport: jest.fn()
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
  test('should setup error handler on Global ErrorUtils and Promise', async () => {
    const rejectTracking = require('promise/setimmediate/rejection-tracking');
    await RaygunClient.init({ apiKey: 'someKey', version: '' });
    expect(rejectTracking.disable).toBeCalled();
    expect(rejectTracking.enable).toBeCalledWith({
      allRejections: true,
      onUnhandled: expect.any(Function)
    });
    expect(ErrorUtils.setGlobalHandler).toBeCalledWith(expect.any(Function));
  });

  test('should correctly pass apiKey to JS transport when enableNative is false', async () => {
    await RaygunClient.init({ apiKey: 'someKey', enableNative: false });
    expect(Rg4rn.init).not.toBeCalled();
    jest.runAllTimers();
    expect(sendCachedReports).toBeCalledTimes(1);
    expect(sendCachedReports).toBeCalledWith('someKey');
  });

  test('should pass RUM options to native side when enabled', async () => {
    Rg4rn.hasRUMPostServiceRunning.mockImplementation(async () => true);
    Platform.OS = 'android';
    await RaygunClient.init({
      apiKey: 'someKey',
      enableRUM: true
    });
    expect(Rg4rn.init).toHaveBeenLastCalledWith(
      {
        apiKey: 'someKey',
        version: ''
      },
      expect.any(Function)
    );
  });

  test('should not pass unnecessary options to native side', async () => {
    Rg4rn.hasRUMPostServiceRunning.mockImplementation(async () => true);
    Platform.OS = 'ios';
    await RaygunClient.init({
      apiKey: 'someKey',
      enableNative: true
    });
    expect(Rg4rn.init).toHaveBeenLastCalledWith(
      {
        apiKey: 'someKey',
        version: ''
      },
      null
    );
  });

  test('should NOT throws when RUM is enabled and Platform is iOS', async () => {
    Rg4rn.hasRUMPostServiceRunning.mockImplementation(() => false);
    Platform.OS = 'ios';
    await RaygunClient.init({
      apiKey: 'someKey',
      enableRUM: true
    });
    expect(Rg4rn.init).toBeCalledWith(
      {
        apiKey: 'someKey',
        version: ''
      },
      expect.any(Function)
    );
  });

  test('should NOT throws when Native SDK is not detected', async () => {
    Platform.OS = 'android';
    NativeModules.Rg4rn.init = undefined;
    try {
      await RaygunClient.init({
        apiKey: 'someKey',
        enableRUM: true
      });
    } catch (error) {
      expect(error).toEqual(Error('Can not enable RUM as native sdk not configured properly'));
    }
    NativeModules.Rg4rn.init = jest.fn();
  });

  test('should NOT automatic turn on network monitoring if user specifically turn it off', async () => {
    Rg4rn.hasRUMPostServiceRunning.mockImplementation(() => false);
    Platform.OS = 'ios';
    await RaygunClient.init({
      apiKey: 'someKey',
      enableRUM: true,
      enableNetworkMonitoring: false
    });
    expect(Rg4rn.init).toBeCalledWith(
      {
        apiKey: 'someKey',
        version: ''
      },
      expect.any(Function)
    );
  });

  test('should not initialize native side and sendCachedReport from JS side when not enableNative', async () => {
    await RaygunClient.init({
      apiKey: 'someKey',
      enableNative: false
    });
    jest.runAllTimers();
    expect(Rg4rn.init).not.toBeCalled();
    expect(sendCachedReports).toBeCalledTimes(1);
    expect(sendCachedReports).toBeCalledWith('someKey');
  });
});

describe('RaygunClient functions', () => {
  test('should pass accumulated tags to backend', async () => {
    await RaygunClient.init({ apiKey: 'someKey' });
    RaygunClient.addTag('a');
    expect(Rg4rn.setTags).lastCalledWith(['React Native', 'a']);
    RaygunClient.addTag('b', 'c');
    expect(Rg4rn.setTags).lastCalledWith(['React Native', 'a', 'b', 'c']);
  });

  test('should pass customData to backend', async () => {
    await RaygunClient.init({ apiKey: 'someKey' });
    RaygunClient.addCustomData({ a: '1' });
    expect(Rg4rn.setCustomData).toBeCalledWith({ a: '1' });
    RaygunClient.addCustomData({ b: '2' });
    expect(Rg4rn.setCustomData).toBeCalledWith({ a: '1', b: '2' });
    RaygunClient.updateCustomData(data => ({ val: 'key' }));
    expect(Rg4rn.setCustomData).toBeCalledWith({ val: 'key' });
  });

  test('should pass correct user to backend', async () => {
    await RaygunClient.init({ apiKey: 'someKey' });
    RaygunClient.setUser('user name');
    expect(Rg4rn.setUser).lastCalledWith({
      identifier: 'user name',
      firstName: '',
      fullName: '',
      email: '',
      isAnonymous: false
    });
    Rg4rn.setUser.mockReset();
    RaygunClient.setUser('');
    expect(Rg4rn.setUser).lastCalledWith({
      identifier: expect.any(String),
      isAnonymous: true,
      firstName: '',
      fullName: '',
      email: ''
    });
    const user = {
      identifier: 'id',
      email: 'email',
      firstName: 'first name',
      fullName: 'fullName'
    };
    Rg4rn.setUser.mockReset();
    RaygunClient.setUser(user);
    expect(Rg4rn.setUser).lastCalledWith({ ...user, isAnonymous: false });
  });

  test('should pass correct breadcrumb to backend', async () => {
    await RaygunClient.init({ apiKey: 'someKey' });
    RaygunClient.recordBreadcrumb('breadcrumbA');
    expect(Rg4rn.recordBreadcrumb).lastCalledWith({
      message: 'breadcrumbA',
      category: '',
      level: 'info',
      customData: {},
      timestamp: expect.any(Number)
    });
    const details: BreadcrumbOption = {
      category: 'bug',
      level: 'info'
    };
    RaygunClient.recordBreadcrumb('breadcrumbB', details);
    expect(Rg4rn.recordBreadcrumb).lastCalledWith({
      message: 'breadcrumbB',
      customData: {},
      category: 'bug',
      level: 'info',
      timestamp: expect.any(Number)
    });
  });
});

describe('Error process function', () => {
  test('should filter out react frames', async () => {
    const restFrames = (internalStackFrames as StackFrame[]).filter(RaygunClient.filterOutReactFrames);
    expect(restFrames).toEqual([internalStackFrames[0], internalStackFrames[5]]);
  });
  test('should filter out "addressAt" ', async () => {
    const restFrames = (stackFramesWithAddress as StackFrame[]).map(RaygunClient.noAddressAt);
    expect(restFrames).toEqual([{ methodName: 'calls' }, { methodName: 'calls' }, { methodName: 'calls' }]);
  });

  test('should generate Crash Report payload', async () => {
    const error = new Error('test error message');
    error.name = 'test error name';
    const customData = { key: 'val' };
    const breadcrumb: Breadcrumb = {
      message: 'breadcrumb',
      category: 'category',
      level: 'info',
      customData: { a: '1' },
      timestamp: 1593750000000
    };
    const session = {
      tags: new Set(['react-native']),
      user: { identifier: 'mock user' },
      customData: { key: 'val' },
      breadcrumbs: [breadcrumb]
    };
    const payload = await RaygunClient.generatePayload(error, fullStackFrames, session);
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
          Version: expect.any(String)
        },
        UserCustomData: customData,
        Tags: ['react-native'],
        User: { Identifier: 'mock user' },
        Breadcrumbs: [
          {
            Message: 'breadcrumb',
            Category: 'category',
            Level: 'info',
            CustomData: { a: '1' },
            Timestamp: 1593750000000
          }
        ],
        Version: 'Not supplied'
      }
    });
  });
});
