import {RealUserMonitoringEvents, User} from "./Types";
import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import {setupNetworkMonitoring} from "./NetworkMonitor";
import {getDeviceBasedId, log, warn} from "./Utils";

const {RaygunNativeBridge} = NativeModules;
const {osVersion, platform} = RaygunNativeBridge;

const defaultURLIgnoreList = ['api.raygun.com', 'localhost:8081/symbolicate'];
const SessionRotateThreshold = 30 * 60 * 100;


export default class RealUserMonitor {

  private readonly currentUser: User;
  private readonly apiKey: string;
  private readonly version: string;
  private readonly disableNetworkMonitoring: boolean;
  private readonly customRealUserMonitoringEndpoint: string;
  private RAYGUN_RUM_ENDPOINT = 'https://api.raygun.com/events';

  lastActiveAt = Date.now();
  curRUMSessionId: string = '';

  constructor(currentUser: User, apiKey: string, disableNetworkMonitoring = true, ignoredURLs: string[], customRealUserMonitoringEndpoint: string, version: string) {

    // Assign the values parsed in (assuming initiation is the only time these are altered).
    this.apiKey = apiKey;
    this.disableNetworkMonitoring = disableNetworkMonitoring;
    this.customRealUserMonitoringEndpoint = customRealUserMonitoringEndpoint;
    this.currentUser = currentUser;
    this.version = version;

    if (!disableNetworkMonitoring) {
      setupNetworkMonitoring(
        ignoredURLs.concat(defaultURLIgnoreList, customRealUserMonitoringEndpoint || []),
        this.generateNetworkTimingEventCallbackMethod.bind(this)
      );
    }

    this.lastActiveAt = Date.now();
    this.curRUMSessionId = '';

    const eventEmitter = new NativeEventEmitter(RaygunNativeBridge);
    eventEmitter.addListener(RaygunNativeBridge.ON_START, this.reportStartupTime.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_PAUSE, this.markLastActiveTime.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_RESUME, this.rotateRUMSession.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_DESTROY, () => {
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_START);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_PAUSE);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_RESUME);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_DESTROY);
    });

  };


  generateNetworkTimingEventCallbackMethod(name: string, sendTime: number, duration: number) {
    const data = {name, timing: {type: RealUserMonitoringEvents.NetworkCall, duration}};
    this.sendRUMEvent(RealUserMonitoringEvents.EventTiming, data, sendTime).catch();
  };


  markLastActiveTime = async () => {
    this.lastActiveAt = Date.now();
  };

  async rotateRUMSession(payload: Record<string, any>) {
    if (Date.now() - this.lastActiveAt > SessionRotateThreshold) {
      this.lastActiveAt = Date.now();
      await this.sendRUMEvent(RealUserMonitoringEvents.SessionEnd, {});
      this.curRUMSessionId = getDeviceBasedId();
      return this.sendRUMEvent(RealUserMonitoringEvents.SessionStart, {});
    }
  };


  async sendRUMEvent(eventName: string, data: Record<string, any>, timeAt?: number) {
    const timestamp = timeAt ? new Date(timeAt) : new Date();
    const rumMessage = {
      type: eventName,
      timestamp: timestamp.toISOString(),
      user: this.currentUser,
      sessionId: this.curRUMSessionId,
      version: this.version,
      os: Platform.OS,
      osVersion,
      platform,
      data: JSON.stringify([data])
    };

    return fetch(this.customRealUserMonitoringEndpoint || this.RAYGUN_RUM_ENDPOINT, {
      method: 'POST',
      headers: {'X-ApiKey': this.apiKey, 'Content-Type': 'application/json'},
      body: JSON.stringify({eventData: [rumMessage]})
    }).catch(err => {
      log(err);
    });
  };


  sendCustomRUMEvent(
    apiKey: string,
    eventType: RealUserMonitoringEvents.ActivityLoaded | RealUserMonitoringEvents.NetworkCall,
    name: string,
    duration: number,
    customRealUserMonitoringEndpoint?: string
  ) {
    if (eventType === RealUserMonitoringEvents.ActivityLoaded) {
      this.reportStartupTime(name, duration);
      return;
    }
    if (eventType === RealUserMonitoringEvents.NetworkCall) {
      this.generateNetworkTimingEventCallbackMethod(name, Date.now() - duration, duration);
      return;
    }
    warn('Unknown RUM event type:', eventType);
  };


  async reportStartupTime(name: string, duration: number) {
    if (!this.curRUMSessionId) {
      this.curRUMSessionId = getDeviceBasedId();
      await this.sendRUMEvent(RealUserMonitoringEvents.SessionStart, {});
    }
    const data = {name, timing: {type: RealUserMonitoringEvents.ActivityLoaded, duration}};
    return this.sendRUMEvent(RealUserMonitoringEvents.EventTiming, data);
  };

}
