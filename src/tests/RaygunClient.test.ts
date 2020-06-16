import { CrashReportPayload, Breadcrumb, BreadcrumbOption } from 'src/types';

const initMock = jest.fn();
const setTagsMock = jest.fn();
const setCustomDataMock = jest.fn();
const setUserMock = jest.fn();
const recordBreadcrumbMock = jest.fn();
const sendCachedReportsMock = jest.fn();
const sendReportMock = jest.fn();

jest.mock('react-native', () => ({
  NativeModules: {
    Rg4rn: {
      init: initMock,
      setTags: setTagsMock,
      setUser: setUserMock,
      setCustomData: setCustomDataMock,
      recordBreadcrumb: recordBreadcrumbMock
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

global.ErrorUtils = {
  setGlobalHandler: jest.fn() as jest.Mock<any>,
  getGlobalHandler: jest.fn() as jest.Mock<any>
};

jest.mock('../transport', () => ({
  sendCachedReports: sendCachedReportsMock,
  sendReport: sendReportMock
}));

jest.useFakeTimers();

afterEach(() => {
  RaygunClient.clearSession();
});

import RaygunClient from '../RaygunClient';
import RN from 'react-native';

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
    expect(initMock).not.toBeCalled();
    jest.runAllTimers();
    expect(sendCachedReportsMock).toBeCalledTimes(1);
    expect(sendCachedReportsMock).toBeCalledWith('someKey', undefined);
  });

  test('should not pass unnecessary options to native side', () => {
    RaygunClient.init({
      apiKey: 'someKey',
      onBeforeSend: (report: CrashReportPayload) => report,
      enableNative: true
    });
    expect(initMock).toHaveBeenLastCalledWith({ apiKey: 'someKey' });
  });

  test('should not initialize native side and sendCachedReport from JS side when not enableNative', () => {
    const onBeforeFn = (report: CrashReportPayload) => report;
    RaygunClient.init({
      apiKey: 'someKey',
      onBeforeSend: onBeforeFn,
      enableNative: false
    });
    jest.runAllTimers();
    expect(initMock).not.toBeCalled();
    expect(sendCachedReportsMock).toBeCalledTimes(1);
    expect(sendCachedReportsMock).toBeCalledWith('someKey', onBeforeFn);
  });
});

describe('RaygunClient functions', () => {
  test('should pass accumulated tags to backend', () => {
    RaygunClient.addTag('a');
    expect(setTagsMock).lastCalledWith(['React Native', 'a']);
    RaygunClient.addTag('b', 'c');
    expect(setTagsMock).lastCalledWith(['React Native', 'a', 'b', 'c']);
  });

  test('should pass customData to backend', () => {
    RaygunClient.addCustomData({ a: '1' });
    expect(setCustomDataMock).toBeCalledWith({ a: '1' });
    RaygunClient.addCustomData({ b: '2' });
    expect(setCustomDataMock).toBeCalledWith({ a: '1', b: '2' });
    RaygunClient.updateCustomData(data => ({ val: 'key' }));
    expect(setCustomDataMock).toBeCalledWith({ val: 'key' });
  });

  test('should pass correct user to backend', () => {
    RaygunClient.setUser('user name');
    expect(setUserMock).lastCalledWith({ identifier: 'user name' });
    RaygunClient.setUser('');
    expect(setUserMock).lastCalledWith({
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
    expect(setUserMock).lastCalledWith(user);
  });

  test('should pass correct breadcrumb to backend', () => {
    RaygunClient.recordBreadcrumb('breadcrumbA');
    expect(recordBreadcrumbMock).lastCalledWith({ message: 'breadcrumbA' });
    const details: BreadcrumbOption = {
      category: 'bug',
      level: 'info',
      className: 'class name',
      methodName: 'method name',
      lineNumber: 0
    };
    RaygunClient.recordBreadcrumb('breadcrumbB', details);
    expect(recordBreadcrumbMock).lastCalledWith({
      message: 'breadcrumbB',
      ...details
    });
  });
});
