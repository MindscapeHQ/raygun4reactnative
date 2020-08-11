import { v4 as uuidv4 } from 'uuid';
import { Session, LifecycleHandler, User, RUMEvents } from './types';
import { setupNetworkMonitoring } from './network-monitor';
import { NativeModules, Platform } from 'react-native';
const { version: clientVersion } = require('../package.json');
import { sendRUMPayload } from './transport';
const { Rg4rn } = NativeModules;

const { osVersion, platform } = Rg4rn;

type lifecycleCallback = (type: string, payload: any) => void;

const SessionRotateThreshold = 30 * 60 * 100;

let lastActiveAt = Date.now();
let curRUMSessionId: any = null;

const reportStartupTime: LifecycleHandler = async (session, payload, apiKey) => {
  const { startupTimeUsed, name } = payload;
  if (!curRUMSessionId) {
    curRUMSessionId = uuidv4();
    await sendRUMEvent(RUMEvents.SessionStart, session.user, {}, curRUMSessionId, apiKey);
  }
  const data = { name, timing: { type: RUMEvents.AppLoaded, duration: startupTimeUsed } };
  return sendRUMEvent(RUMEvents.EventTiming, session.user, data, curRUMSessionId, apiKey);
};

const markLastActiveTime: LifecycleHandler = () => {
  lastActiveAt = Date.now();
};

const rotateRUMSession: LifecycleHandler = async (session, payload, apiKey) => {
  const sinceLastActive = Date.now() - lastActiveAt;
  if (sinceLastActive > SessionRotateThreshold) {
    lastActiveAt = Date.now();
    const { osVersion, platform } = payload;
    await sendRUMEvent(RUMEvents.SessionEnd, session.user, {}, curRUMSessionId, apiKey);
    curRUMSessionId = uuidv4();
    return sendRUMEvent(RUMEvents.SessionStart, session.user, {}, curRUMSessionId, apiKey);
  }
};

const lifecycleHandlers: Record<string, LifecycleHandler> = {
  [Rg4rn.ON_START]: reportStartupTime,
  [Rg4rn.ON_RESUME]: rotateRUMSession,
  [Rg4rn.ON_PAUSE]: markLastActiveTime,
  [Rg4rn.ON_DESTROY]: () => {},
  ['undefined']: () => {}
};

const lifecycleCallbackDispatch = (session: Session, apiKey: string) => (type: string, payload: any): void => {
  const handler = lifecycleHandlers[type];
  if (handler) {
    return handler(session, payload, apiKey);
  }
  console.error('Unknown lifecycle:', type, payload);
};

const sendNetworkTimingEvent = (session: Session, apiKey: string) => (
  name: string,
  sendTime: number,
  duration: number
): void => {
  const data = { name, timing: { type: RUMEvents.NetworkCall, duration } };
  sendRUMEvent(RUMEvents.EventTiming, session.user, data, curRUMSessionId, apiKey, sendTime);
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
    data
  };
  return sendRUMPayload(rumMessage, apiKey);
};

export const setupRealtimeUserMonitoring = (
  enableNetworkMonitoring = true,
  ignoredUrls = [] as string[],
  curSession: Session,
  apiKey: string
): lifecycleCallback => {
  if (enableNetworkMonitoring) {
    setupNetworkMonitoring(ignoredUrls.concat('api.raygun.io'), sendNetworkTimingEvent(curSession, apiKey));
  }

  return lifecycleCallbackDispatch(curSession, apiKey);
};
