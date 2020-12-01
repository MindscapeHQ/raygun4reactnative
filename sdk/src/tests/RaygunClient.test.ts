import { Breadcrumb, BreadcrumbOption, CustomData, RaygunStackFrame } from '../Types';
import { internalStackFrames, stackFramesWithAddress, fullStackFrames } from './fixture/errors';
import { sendCachedReports, sendCrashReport } from '../Transport';
import { setupRealtimeUserMonitoring } from '../RealUserMonitoring';

jest.mock('../RealUserMonitoring', () => ({
  setupRealtimeUserMonitoring: jest.fn()
}));

jest.mock('../NetworkMonitor', () => ({
  setupNetworkMonitoring: jest.fn()
}));

jest.mock('react-native/Libraries/Core/Devtools/parseErrorStack', () => jest.fn().mockReturnValue({}));
jest.mock('react-native/Libraries/Core/Devtools/symbolicateStackTrace', () => jest.fn().mockReturnValue({}));

jest.mock('react-native', () => ({
  NativeModules: {
    RaygunNativeBridge: {
      init: jest.fn(),
      setTags: jest.fn(),
      setUser: jest.fn(),
      setCustomData: jest.fn(),
      recordBreadcrumb: jest.fn(),
      clearSession: jest.fn(),
      hasInitialized: jest.fn().mockResolvedValue(false),
      getEnvironmentInfo: jest.fn().mockResolvedValue({}),
      sendCrashReport: jest.fn().mockResolvedValue(true)
    }
  },
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn()
  })),
  Platform: {
    OS: ''
  }
}));

jest.mock('promise/setimmediate/rejection-tracking', () => ({
  disable: jest.fn(),
  enable: jest.fn()
}));

jest.mock('../Transport', () => ({
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

const { RaygunNativeBridge } = NativeModules;
const mockPayload = {
  OccurredOn: new Date(),
  Details: {
    Error: {
      ClassName: '',
      Message: '',
      StackTrace: [] as RaygunStackFrame[],
      StackString: ''
    },
    Environment: {
      UtcOffset: new Date().getTimezoneOffset() / 60
    },
    Client: {
      Name: '',
      Version: ''
    },
    UserCustomData: {} as CustomData,
    Version: ''
  }
};

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

  test('should correctly pass apiKey to JS transport when disableNativeCrashReporting is false', async () => {
    await RaygunClient.init({ apiKey: 'someKey', disableNativeCrashReporting: true, enableRealUserMonitoring: false });
    expect(RaygunNativeBridge.init).not.toBeCalled();
    jest.runAllTimers();
    expect(sendCachedReports).toBeCalledTimes(1);
    expect(sendCachedReports).toBeCalledWith('someKey', undefined);
  });

  test('should pass RUM options to native side when enabled', async () => {
    await RaygunClient.init({
      apiKey: 'someKey',
      enableRealUserMonitoring: true
    });
    expect(RaygunNativeBridge.init).toHaveBeenLastCalledWith({
      apiKey: 'someKey',
      version: '',
      enableRealUserMonitoring: true
    });
  });

  test('should not pass unnecessary options to native side', async () => {
    await RaygunClient.init({
      apiKey: 'someKey',
      disableNativeCrashReporting: false
    });
    expect(RaygunNativeBridge.init).toHaveBeenLastCalledWith({
      apiKey: 'someKey',
      version: '',
      enableRealUserMonitoring: true
    });
  });

  test('should pass custom RUM endpoint to realtime-user-monitor when given', async () => {
    await RaygunClient.init({
      apiKey: 'someKey',
      enableRealUserMonitoring: true,
      customRealUserMonitoringEndpoint: 'rum.endpoint.io'
    });
    expect(setupRealtimeUserMonitoring).toBeCalledWith(expect.any(Function), 'someKey', true, [], 'rum.endpoint.io');
  });

  test('should pass custom CrashReporting endpoint to native side when given', async () => {
    await RaygunClient.init({
      apiKey: 'someKey',
      enableRealUserMonitoring: true,
      customCrashReportingEndpoint: 'cr.endpoint.io'
    });
    expect(RaygunNativeBridge.init).toHaveBeenLastCalledWith({
      apiKey: 'someKey',
      version: '',
      enableRealUserMonitoring: true,
      customCrashReportingEndpoint: 'cr.endpoint.io'
    });
  });

  test('should NOT automatic turn on network monitoring if user specifically turn it off', async () => {
    Platform.OS = 'ios';
    await RaygunClient.init({
      apiKey: 'someKey',
      enableRealUserMonitoring: true,
      disableNetworkMonitoring: true
    });
    expect(RaygunNativeBridge.init).toBeCalledWith({
      apiKey: 'someKey',
      version: '',
      enableRealUserMonitoring: true
    });
  });

  test('should still initialize native side but not calling sendCachedReport from JS side when not disableNativeCrashReporting', async () => {
    await RaygunClient.init({
      apiKey: 'someKey',
      disableNativeCrashReporting: true
    });
    jest.runAllTimers();
    expect(RaygunNativeBridge.init).toBeCalledWith({ apiKey: 'someKey', version: expect.any(String), enableRealUserMonitoring: true });
    expect(sendCachedReports).toBeCalledTimes(1);
    expect(sendCachedReports).toBeCalledWith('someKey', undefined);
  });
});

describe('RaygunClient functions', () => {
  test('should pass accumulated tags to backend', async () => {
    await RaygunClient.init({ apiKey: 'someKey' });
    RaygunClient.addTag('a');
    expect(RaygunNativeBridge.setTags).lastCalledWith(['React Native', 'a']);
    RaygunClient.addTag('b', 'c');
    expect(RaygunNativeBridge.setTags).lastCalledWith(['React Native', 'a', 'b', 'c']);
  });

  test('should pass customData to backend', async () => {
    await RaygunClient.init({ apiKey: 'someKey' });
    RaygunClient.addCustomData({ a: '1' });
    expect(RaygunNativeBridge.setCustomData).toBeCalledWith({ a: '1' });
    RaygunClient.addCustomData({ b: '2' });
    expect(RaygunNativeBridge.setCustomData).toBeCalledWith({ a: '1', b: '2' });
    RaygunClient.updateCustomData(data => ({ val: 'key' }));
    expect(RaygunNativeBridge.setCustomData).toBeCalledWith({ val: 'key' });
  });

  test('should pass correct user to backend', async () => {
    await RaygunClient.init({ apiKey: 'someKey' });
    RaygunClient.setUser('user name');
    expect(RaygunNativeBridge.setUser).lastCalledWith({
      identifier: 'user name',
      firstName: '',
      fullName: '',
      email: '',
      isAnonymous: false
    });
    RaygunNativeBridge.setUser.mockReset();
    RaygunClient.setUser('');
    expect(RaygunNativeBridge.setUser).lastCalledWith({
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
    RaygunNativeBridge.setUser.mockReset();
    RaygunClient.setUser(user);
    expect(RaygunNativeBridge.setUser).lastCalledWith({ ...user, isAnonymous: false });
  });

  test('should pass correct breadcrumb to backend', async () => {
    await RaygunClient.init({ apiKey: 'someKey' });
    RaygunClient.recordBreadcrumb('breadcrumbA');
    expect(RaygunNativeBridge.recordBreadcrumb).lastCalledWith({
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
    expect(RaygunNativeBridge.recordBreadcrumb).lastCalledWith({
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
    const payload = await RaygunClient.generateCrashReportPayload(error, fullStackFrames, session);
    expect(payload).toEqual({
      OccurredOn: expect.any(Date),
      Details: {
        Environment: {
          JailBroken: false,
          UtcOffset: new Date().getTimezoneOffset() / 60
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

describe('Sending errors', () => {
  test('Should use native sendCrashReport when enable native crash reporting', async () => {
    await RaygunClient.init({ apiKey: 'someKey', disableNativeCrashReporting: false });
    await RaygunClient.sendCustomError(new Error('Test Native Report'));
    expect(RaygunNativeBridge.sendCrashReport).toBeCalledTimes(1);
    expect(sendCrashReport).toBeCalledTimes(0);
  });

  test('Should use JS sendCrashReport when disable native crash reporting', async () => {
    await RaygunClient.init({ apiKey: 'someKey', disableNativeCrashReporting: true });
    await RaygunClient.sendCustomError(new Error('Test JS Report'));
    expect(sendCrashReport).toBeCalledTimes(1);
    expect(RaygunNativeBridge.sendCrashReport).toBeCalledTimes(0);
  });

  test('Should stop sendCrashReport when onBeforeHandler returns falsy value', async () => {
    await RaygunClient.init({ apiKey: 'someKey', onBeforeSendingCrashReport: () => null });
    await RaygunClient.sendCustomError(new Error('Test JS Report'));
    expect(sendCrashReport).toBeCalledTimes(0);
    expect(RaygunNativeBridge.sendCrashReport).toBeCalledTimes(0);
  });

  test('Should use native sendCrashReport with the payload returned from onBeforeHandler', async () => {
    await RaygunClient.init({ apiKey: 'someKey', onBeforeSendingCrashReport: () => mockPayload, disableNativeCrashReporting: false });
    await RaygunClient.sendCustomError(new Error('Test JS Report'));
    expect(sendCrashReport).toBeCalledTimes(0);
    expect(RaygunNativeBridge.sendCrashReport).toBeCalledTimes(1);
    expect(RaygunNativeBridge.sendCrashReport).toBeCalledWith(JSON.stringify(mockPayload), 'someKey');
  });

  test('Should use native sendCrashReport with the payload returned from onBeforeHandler', async () => {
    await RaygunClient.init({ apiKey: 'someKey', onBeforeSendingCrashReport: () => mockPayload, disableNativeCrashReporting: true });
    await RaygunClient.sendCustomError(new Error('Test JS Report'));
    expect(sendCrashReport).toBeCalledTimes(1);
    expect(RaygunNativeBridge.sendCrashReport).toBeCalledTimes(0);
    expect(sendCrashReport).toBeCalledWith(mockPayload, 'someKey', undefined);
  });

  test('Should be able to use custom endpoint for CrashReporting when using JS transport', async () => {
    await RaygunClient.init({
      apiKey: 'someKey',
      onBeforeSendingCrashReport: () => mockPayload,
      disableNativeCrashReporting: true,
      customCrashReportingEndpoint: 'demo.crashreport.ios'
    });
    await RaygunClient.sendCustomError(new Error('Test JS Report'));
    expect(sendCrashReport).toBeCalledTimes(1);
    expect(RaygunNativeBridge.sendCrashReport).toBeCalledTimes(0);
    expect(sendCrashReport).toBeCalledWith(mockPayload, 'someKey', 'demo.crashreport.ios');
  });

  test('Should be able to send customData with sendCustomError function', async () => {
    const customData = { dataKey: 'test' }
    await RaygunClient.init({
      apiKey: 'someKey',
      onBeforeSendingCrashReport: (actualPayload) => ({ ...mockPayload, Details: { ...mockPayload.Details, UserCustomData: actualPayload.Details.UserCustomData } }),
      disableNativeCrashReporting: true
    });
    await RaygunClient.sendCustomError(new Error('Test JS Report'), customData);
    expect(sendCrashReport).toBeCalledTimes(1);
    expect(RaygunNativeBridge.sendCrashReport).toBeCalledTimes(0);
    expect(sendCrashReport).toBeCalledWith({...mockPayload, ...{ Details: { ...mockPayload.Details, UserCustomData: customData } }}, 'someKey', undefined);
  });

  test('Should be able to send tags with sendCustomError function', async () => {
    const tags = ['test1', 'test2'];
    await RaygunClient.init({
      apiKey: 'someKey',
      onBeforeSendingCrashReport: (actualPayload) => ({ ...mockPayload, Details: { ...mockPayload.Details, Tags: actualPayload.Details.Tags } }),
      disableNativeCrashReporting: true
    });
    await RaygunClient.sendCustomError(new Error('Test JS Report'), tags);
    expect(sendCrashReport).toBeCalledTimes(1);
    expect(RaygunNativeBridge.sendCrashReport).toBeCalledTimes(0);
    expect(sendCrashReport).toBeCalledWith({...mockPayload, ...{ Details: { ...mockPayload.Details, Tags: ['React Native'].concat(tags) } }}, 'someKey', undefined);
  });

  test('Should be able to send customData and tags with sendCustomError function', async () => {
    const tags = ['test1', 'test2'];
    const customData = { dataKey: 'test' }
    await RaygunClient.init({
      apiKey: 'someKey',
      onBeforeSendingCrashReport: (actualPayload) => ({ ...mockPayload, Details: { ...mockPayload.Details, UserCustomData: actualPayload.Details.UserCustomData, Tags: actualPayload.Details.Tags } }),
      disableNativeCrashReporting: true
    });
    await RaygunClient.sendCustomError(new Error('Test JS Report'), customData, tags);
    expect(sendCrashReport).toBeCalledTimes(1);
    expect(RaygunNativeBridge.sendCrashReport).toBeCalledTimes(0);
    expect(sendCrashReport).toBeCalledWith({...mockPayload, ...{ Details: { ...mockPayload.Details, UserCustomData: customData, Tags: ['React Native'].concat(tags) } }}, 'someKey', undefined);
  });
});
