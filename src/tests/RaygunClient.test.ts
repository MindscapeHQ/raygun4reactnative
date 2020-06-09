import RaygunClient from '../RaygunClient';
import { sendCachedReports } from '../transport';

jest.mock('react-native', () => ({
  NativeModules: {
    Rg4rn: {
      init: jest.fn(),
      addTag: jest.fn(),
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

describe('RaygunClient Unit Tests', () => {
  test('init should correctly pass options to native and send cached reports', () => {
    const RN = require('react-native');
    RaygunClient.init({ apiKey: 'someKey' });
    expect(RN.NativeModules.Rg4rn.init).toBeCalledWith({ apiKey: 'someKey' });
    expect(ErrorUtils.setGlobalHandler).toHaveBeenCalledWith(
      expect.any(Function)
    );
    jest.runAllTimers();
    expect(sendCachedReports).toHaveBeenLastCalledWith('someKey');
  });
});
