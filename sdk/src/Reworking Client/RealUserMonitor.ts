import {RUMEvents, User} from "./Types";
import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import {setupNetworkMonitoring} from "../NetworkMonitor";
import {getDeviceBasedId, warn} from "./Utils";
import {sendRUMPayload} from "../Transport";


const {RaygunNativeBridge} = NativeModules;
const {osVersion, platform} = RaygunNativeBridge;

const defaultURLIgnoreList = ['api.raygun.com', 'localhost:8081/symbolicate'];
const SessionRotateThreshold = 30 * 60 * 100;


export default class RealUserMonitor {

  private getCurrentUser: () => User;
  private enabled: boolean = false;
  private apiKey: string;
  private version: string;
  private disableNetworkMonitoring: boolean;
  private customRealUserMonitoringEndpoint: string;
  private ignoredURLs: string[];

  lastActiveAt = Date.now();
  curRUMSessionId: string = '';

  constructor(getCurrentUser: () => User, apiKey: string, disableNetworkMonitoring = true, ignoredURLs: string[], customRealUserMonitoringEndpoint: string, version: string) {

    this.enabled = true;  //TODO

    if (!disableNetworkMonitoring) {
      setupNetworkMonitoring(
        ignoredURLs.concat(defaultURLIgnoreList, customRealUserMonitoringEndpoint || []),
        this.generateNetworkTimingEventCallbackMethod
      );
    }

    this.lastActiveAt = Date.now();
    this.curRUMSessionId = '';

    let eventEmitter = new NativeEventEmitter(RaygunNativeBridge);
    eventEmitter.addListener(RaygunNativeBridge.ON_START, this.reportStartupTime);
    eventEmitter.addListener(RaygunNativeBridge.ON_PAUSE, this.markLastActiveTime);
    eventEmitter.addListener(RaygunNativeBridge.ON_RESUME, this.rotateRUMSession);
    eventEmitter.addListener(RaygunNativeBridge.ON_DESTROY, () => {
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_START);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_PAUSE);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_RESUME);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_DESTROY);
    });

    // Assign the values parsed in (assuming initiation is the only time these are altered).
    this.apiKey = apiKey;
    this.disableNetworkMonitoring = disableNetworkMonitoring;
    this.ignoredURLs = ignoredURLs;
    this.customRealUserMonitoringEndpoint = customRealUserMonitoringEndpoint;
    this.getCurrentUser = getCurrentUser;
    this.version = version;
  };


  generateNetworkTimingEventCallbackMethod(name: string, sendTime: number,duration: number){
    let data = {name, timing: {type: RUMEvents.NetworkCall, duration}};
    this.sendRUMEvent(RUMEvents.EventTiming, data, sendTime);
  };


  markLastActiveTime = async () => {
    this.lastActiveAt = Date.now();
  };

  async rotateRUMSession(payload: Record<string, any>) {
    if (Date.now() - this.lastActiveAt > SessionRotateThreshold) {
      this.lastActiveAt = Date.now();
      await this.sendRUMEvent(RUMEvents.SessionEnd, {});
      this.curRUMSessionId = getDeviceBasedId();
      return this.sendRUMEvent(RUMEvents.SessionStart, {});
    }
  };


  async sendRUMEvent(eventName: string, data: Record<string, any>, timeAt?: number) {
    let timestamp = timeAt ? new Date(timeAt) : new Date();
    let rumMessage = {
      type: eventName,
      timestamp: timestamp.toISOString(),
      user: this.getCurrentUser(),
      sessionId: this.curRUMSessionId,
      version: this.version,
      os: Platform.OS,
      osVersion,
      platform,
      data: JSON.stringify([data])
    };
    return sendRUMPayload(rumMessage, this.apiKey, this.customRealUserMonitoringEndpoint);
  };


  sendCustomRUMEvent(
    getCurrentUser: () => User,
    apiKey: string,
    eventType: RUMEvents.ActivityLoaded | RUMEvents.NetworkCall,
    name: string,
    duration: number,
    customRealUserMonitoringEndpoint?: string
  ) {
    if (eventType === RUMEvents.ActivityLoaded) {
      this.reportStartupTime(name, duration);
      return;
    }
    if (eventType === RUMEvents.NetworkCall) {
      this.generateNetworkTimingEventCallbackMethod(name, Date.now() - duration, duration);
      return;
    }
    warn('Unknown RUM event type:', eventType);
  };


  async reportStartupTime(name: string, duration: number) {
    if (!this.curRUMSessionId) {
      this.curRUMSessionId = getDeviceBasedId();
      await this.sendRUMEvent(RUMEvents.SessionStart, {});
    }
    let data = {name, timing: {type: RUMEvents.ActivityLoaded, duration}};
    return this.sendRUMEvent(RUMEvents.EventTiming, data);
  };

}
