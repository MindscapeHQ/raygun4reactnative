import { User, RUMEvents } from './types';
import { setupNetworkMonitoring } from './network-monitor';
import { getDeviceBasedId } from './utils';
import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
const { version: clientVersion } = require('../package.json');
import { sendRUMPayload } from './transport';
import { warn } from './utils';
const { Rg4rn } = NativeModules;

const { osVersion, platform } = Rg4rn;

const defaultURLIgnoreList = ['api.raygun.com', 'localhost:8081/symbolicate'];

const SessionRotateThreshold = 30 * 60 * 100;

let lastActiveAt = Date.now();
let curRUMSessionId: string = '';

const reportStartupTime = (getCurrentUser: () => User, apiKey: string, customRUMEndpoint?: string) => async (
  payload: Record<string, any>
) => {
  const { duration, name } = payload;
  if (!curRUMSessionId) {
    curRUMSessionId = getDeviceBasedId();
    await sendRUMEvent(RUMEvents.SessionStart, getCurrentUser(), {}, curRUMSessionId, apiKey, customRUMEndpoint);
  }
  const data = { name, timing: { type: RUMEvents.ActivityLoaded, duration } };
  return sendRUMEvent(RUMEvents.EventTiming, getCurrentUser(), data, curRUMSessionId, apiKey, customRUMEndpoint);
};

const markLastActiveTime = async () => {
  lastActiveAt = Date.now();
};

const rotateRUMSession = (getCurrentUser: () => User, apiKey: string, customRUMEndpoint?: string) => async (
  payload: Record<string, any>
) => {
  if (Date.now() - lastActiveAt > SessionRotateThreshold) {
    lastActiveAt = Date.now();
    await sendRUMEvent(RUMEvents.SessionEnd, getCurrentUser(), {}, curRUMSessionId, apiKey, customRUMEndpoint);
    curRUMSessionId = getDeviceBasedId();
    return sendRUMEvent(RUMEvents.SessionStart, getCurrentUser(), {}, curRUMSessionId, apiKey, customRUMEndpoint);
  }
};

const sendNetworkTimingEvent = (getCurrentUser: () => User, apiKey: string, customRUMEndpoint?: string) => (
  name: string,
  sendTime: number,
  duration: number
): void => {
  const data = { name, timing: { type: RUMEvents.NetworkCall, duration } };
  sendRUMEvent(RUMEvents.EventTiming, getCurrentUser(), data, curRUMSessionId, apiKey, customRUMEndpoint, sendTime);
};

const sendRUMEvent = async (
  eventName: string,
  user: User,
  data: Record<string, any>,
  sessionId: string,
  apiKey: string,
  customRUMEndpoint?: string,
  timeAt?: number
) => {
  const timestamp = timeAt ? new Date(timeAt) : new Date();
  const rumMessage = {
    type: eventName,
    timestamp: timestamp.toISOString(),
    user,
    sessionId,
    version: clientVersion,
    os: Platform.OS,
    osVersion,
    platform,
    data: JSON.stringify([data])
  };
  return sendRUMPayload(rumMessage, apiKey, customRUMEndpoint);
};

export const setupRealtimeUserMonitoring = (
  getCurrentUser: () => User,
  apiKey: string,
  enableNetworkMonitoring = true,
  ignoredUrls = [] as string[],
  customRUMEndpoint?: string
) => {
  if (enableNetworkMonitoring) {
    setupNetworkMonitoring(
      ignoredUrls.concat(defaultURLIgnoreList, customRUMEndpoint || []),
      sendNetworkTimingEvent(getCurrentUser, apiKey, customRUMEndpoint)
    );
  }

  lastActiveAt = Date.now();
  curRUMSessionId = '';

  const eventEmitter = new NativeEventEmitter(Rg4rn);
  eventEmitter.addListener(Rg4rn.ON_START, reportStartupTime(getCurrentUser, apiKey, customRUMEndpoint));
  eventEmitter.addListener(Rg4rn.ON_PAUSE, markLastActiveTime);
  eventEmitter.addListener(Rg4rn.ON_RESUME, rotateRUMSession(getCurrentUser, apiKey, customRUMEndpoint));
  eventEmitter.addListener(Rg4rn.ON_DESTROY, () => {
    eventEmitter.removeAllListeners(Rg4rn.ON_START);
    eventEmitter.removeAllListeners(Rg4rn.ON_PAUSE);
    eventEmitter.removeAllListeners(Rg4rn.ON_RESUME);
    eventEmitter.removeAllListeners(Rg4rn.ON_DESTROY);
  });
};

export const sendCustomRUMEvent = (
  getCurrentUser: () => User,
  apiKey: string,
  eventType: RUMEvents.ActivityLoaded | RUMEvents.NetworkCall,
  name: string,
  duration: number,
  customRUMEndpoint?: string
) => {
  if (eventType === RUMEvents.ActivityLoaded) {
    reportStartupTime(getCurrentUser, apiKey)({ name, duration });
    return;
  }
  if (eventType === RUMEvents.NetworkCall) {
    sendNetworkTimingEvent(getCurrentUser, apiKey, customRUMEndpoint)(name, Date.now() - duration, duration);
    return;
  }
  warn('Unknown RUM event type:', eventType);
};
