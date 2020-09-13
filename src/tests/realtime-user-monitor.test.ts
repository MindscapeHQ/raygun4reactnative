import MockDate from 'mockdate';
import { User, RUMEvents } from '../types';
import { setupRealtimeUserMonitoring } from '../realtime-user-monitor';
import { setupNetworkMonitoring } from '../network-monitor';
import { sendRUMPayload } from '../transport';

jest.mock('../network-monitor', () => ({
  setupNetworkMonitoring: jest.fn()
}));

jest.mock('../transport', () => ({
  sendRUMPayload: jest.fn()
}));

const addListener = jest.fn();
const removeAllListeners = jest.fn();

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
      osVersion: 'osVersion',
      platform: 'platform',
      DEVICE_ID: 'DEVICE_ID'
    }
  },
  NativeEventEmitter: jest.fn(() => ({
    addListener,
    removeAllListeners
  })),
  Platform: {
    OS: 'android'
  }
}));

const currentUser = {
  identifier: 'any'
};

const getCurrentUser = jest.fn(() => currentUser);

describe('Setup user monitoring', () => {
  test('Should correctly setup listeners when enableNetworkMonitoring is on', () => {
    setupRealtimeUserMonitoring(getCurrentUser, 'apiKey', true, []);
    expect(setupNetworkMonitoring).toBeCalledWith(
      ['api.raygun.io', 'localhost:8081/symbolicate'],
      expect.any(Function)
    );
    expect(addListener).toBeCalledTimes(4);
  });

  test('Should correctly setup listeners when enableNetworkMonitoring is off', () => {
    setupRealtimeUserMonitoring(getCurrentUser, 'apiKey', false, []);
    expect(addListener).toBeCalledTimes(4);
  });
});

describe('Send RUM events', () => {
  afterEach(() => {
    MockDate.reset();
  });

  test('Should correctly send out payload from onStart event', async () => {
    setupRealtimeUserMonitoring(getCurrentUser, 'apiKey', true, []);
    const onStartHandler = addListener.mock.calls[0][1] as (payload: Record<string, any>) => void;
    await onStartHandler({ duration: 1000, name: 'MainActivity' });
    expect(sendRUMPayload).toHaveBeenNthCalledWith(
      1,
      {
        type: RUMEvents.SessionStart,
        timestamp: expect.any(String),
        sessionId: expect.any(String),
        version: expect.any(String),
        os: 'android',
        osVersion: 'osVersion',
        platform: 'platform',
        user: currentUser,
        data: JSON.stringify([{}])
      },
      'apiKey'
    );
    expect(sendRUMPayload).toHaveBeenNthCalledWith(
      2,
      {
        type: RUMEvents.EventTiming,
        timestamp: expect.any(String),
        sessionId: expect.any(String),
        version: expect.any(String),
        os: 'android',
        osVersion: 'osVersion',
        platform: 'platform',
        user: currentUser,
        data: JSON.stringify([{ name: 'MainActivity', timing: { type: RUMEvents.ActivityLoaded, duration: 1000 } }])
      },
      'apiKey'
    );
  });

  test('Should send out session rotating payload from onResume when onPause called more than 30 minutes ago', async () => {
    setupRealtimeUserMonitoring(getCurrentUser, 'apiKey', true, []);
    const onPauseHandler = addListener.mock.calls[1][1] as (payload?: Record<string, any>) => void;
    const onResumeHandler = addListener.mock.calls[2][1] as (payload: Record<string, any>) => void;
    await onPauseHandler();
    MockDate.set(Date.now() + 35 * 60 * 1000);
    await onResumeHandler({ startupTimeUsed: 1000, name: 'MainActivity' });
    expect(sendRUMPayload).toHaveBeenNthCalledWith(
      1,
      {
        type: RUMEvents.SessionEnd,
        timestamp: expect.any(String),
        sessionId: expect.any(String),
        version: expect.any(String),
        os: 'android',
        osVersion: 'osVersion',
        platform: 'platform',
        user: currentUser,
        data: JSON.stringify([{}])
      },
      'apiKey'
    );
    expect(sendRUMPayload).toHaveBeenNthCalledWith(
      2,
      {
        type: RUMEvents.SessionStart,
        timestamp: expect.any(String),
        sessionId: expect.any(String),
        version: expect.any(String),
        os: 'android',
        osVersion: 'osVersion',
        platform: 'platform',
        user: currentUser,
        data: JSON.stringify([{}])
      },
      'apiKey'
    );
  });

  test('Should not send out session rotate payload from onResume when onPause called less than 30 minutes', async () => {
    setupRealtimeUserMonitoring(getCurrentUser, 'apiKey', true, []);
    const onPauseHandler = addListener.mock.calls[1][1] as (payload?: Record<string, any>) => void;
    const onResumeHandler = addListener.mock.calls[2][1] as (payload: Record<string, any>) => void;
    await onPauseHandler();
    await onResumeHandler({ startupTimeUsed: 1000, name: 'MainActivity' });
    expect(sendRUMPayload).not.toBeCalled();
  });
});
