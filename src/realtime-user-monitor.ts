import { User, RUMEvents } from './types';
import { setupNetworkMonitoring } from './network-monitor';
import { getDeviceBasedId } from './utils';
import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
const { version: clientVersion } = require('../package.json');
import { sendRUMPayload } from './transport';
const { Rg4rn } = NativeModules;

const { osVersion, platform } = Rg4rn;

const defaultURLIgnoreList = ['api.raygun.io', 'localhost:8081/symbolicate'];

const SessionRotateThreshold = 30 * 60 * 100;

let lastActiveAt = Date.now();
let curRUMSessionId: any = null;

const reportStartupTime = (getCurrentUser: () => User, apiKey: string) => async (payload: Record<string, any>) => {
  const { duration, name } = payload;
  if (!curRUMSessionId) {
    curRUMSessionId = getDeviceBasedId();
    await sendRUMEvent(RUMEvents.SessionStart, getCurrentUser(), {}, curRUMSessionId, apiKey);
  }
  const data = { name, timing: { type: RUMEvents.ActivityLoaded, duration } };
  return sendRUMEvent(RUMEvents.EventTiming, getCurrentUser(), data, curRUMSessionId, apiKey);
};

const markLastActiveTime = async () => {
  lastActiveAt = Date.now();
};

const rotateRUMSession = (getCurrentUser: () => User, apiKey: string) => async (payload: Record<string, any>) => {
  if (Date.now() - lastActiveAt > SessionRotateThreshold) {
    lastActiveAt = Date.now();
    await sendRUMEvent(RUMEvents.SessionEnd, getCurrentUser(), {}, curRUMSessionId, apiKey);
    curRUMSessionId = getDeviceBasedId();
    return sendRUMEvent(RUMEvents.SessionStart, getCurrentUser(), {}, curRUMSessionId, apiKey);
  }
};

const sendNetworkTimingEvent = (getCurrentUser: () => User, apiKey: string) => (
  name: string,
  sendTime: number,
  duration: number
): void => {
  const data = { name, timing: { type: RUMEvents.NetworkCall, duration } };
  sendRUMEvent(RUMEvents.EventTiming, getCurrentUser(), data, curRUMSessionId, apiKey, sendTime);
};

const sendRUMEvent = async (
  eventName: string,
  user: User,
  data: Record<string, any>,
  sessionId: string,
  apiKey: string,
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
  return sendRUMPayload(rumMessage, apiKey);
};

export const setupRealtimeUserMonitoring = (
  getCurrentUser: () => User,
  apiKey: string,
  enableNetworkMonitoring = true,
  ignoredUrls = [] as string[]
) => {
  if (enableNetworkMonitoring) {
    setupNetworkMonitoring(ignoredUrls.concat(defaultURLIgnoreList), sendNetworkTimingEvent(getCurrentUser, apiKey));
  }

  const eventEmitter = new NativeEventEmitter(Rg4rn);
  eventEmitter.addListener(Rg4rn.ON_START, reportStartupTime(getCurrentUser, apiKey));
  eventEmitter.addListener(Rg4rn.ON_PAUSE, markLastActiveTime);
  eventEmitter.addListener(Rg4rn.ON_RESUME, rotateRUMSession(getCurrentUser, apiKey));
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
  duration: number
) => {
  if (eventType === RUMEvents.ActivityLoaded) {
    reportStartupTime(getCurrentUser, apiKey)({ name, duration });
    return;
  }
  if (eventType === RUMEvents.NetworkCall) {
    sendNetworkTimingEvent(getCurrentUser, apiKey)(name, Date.now() - duration, duration);
    return;
  }
  console.warn('Unknown RUM event type:', eventType);
};
