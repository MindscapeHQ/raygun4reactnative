import { RealUserMonitoringEvents, RealUserMonitoringAssetType, Session } from './Types';
import { setupNetworkMonitoring } from './NetworkMonitor';
import { getDeviceBasedId, log, warn } from './Utils';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const { RaygunNativeBridge } = NativeModules;
const { osVersion, platform } = RaygunNativeBridge;

const defaultURLIgnoreList = ['api.raygun.com', 'localhost:8081/symbolicate'];
const SessionRotateThreshold = 30 * 60 * 1000; //milliseconds (equivalent to 30 minutes)

/**
 * The Real User Monitor class is responsible for managing all logic for RUM specific tasks.
 */
export default class RealUserMonitor {

  //#region ----INITIALIZATION----------------------------------------------------------------------

  private readonly currentSession: Session;
  private readonly apiKey: string;
  private readonly version: string;
  private readonly disableNetworkMonitoring: boolean;
  private readonly customRealUserMonitoringEndpoint: string;
  private RAYGUN_RUM_ENDPOINT = 'https://api.raygun.com/events';

  lastActiveAt = Date.now();
  curRUMSessionId: string = '';

  /**
   * RealUserMonitor: Manages RUM specific logic tasks.
   * @param currentSession - The session shared between the CrashReporter and RaygunClient.
   * @param apiKey - The User's API key that gives them access to RUM. (User provided)
   * @param disableNetworkMonitoring - If true, XHRInterceptor is not switched on. All requests go through without monitoring.
   * @param ignoredURLs - A string array of URLs to ignore when watching the network.
   * @param customRealUserMonitoringEndpoint - The custom API URL endpoint where this API should send data to.
   * @param version - The Version number of this application. (User provided)
   */
  constructor(
    currentSession: Session,
    apiKey: string,
    disableNetworkMonitoring = true,
    ignoredURLs: string[],
    customRealUserMonitoringEndpoint: string,
    version: string
  ) {
    // Assign the values parsed in (assuming initiation is the only time these are altered).
    this.apiKey = apiKey;
    this.disableNetworkMonitoring = disableNetworkMonitoring;
    this.customRealUserMonitoringEndpoint = customRealUserMonitoringEndpoint;
    this.currentSession = currentSession;
    this.version = version;

    // If the USER has not defined disabling network monitoring, setup the XHRInterceptor (see
    // NetworkMonitor.ts).
    if (!disableNetworkMonitoring) {
      setupNetworkMonitoring(
        ignoredURLs.concat(defaultURLIgnoreList, customRealUserMonitoringEndpoint || []),
        this.sendNetworkTimingEvent.bind(this)
      );
    }

    this.lastActiveAt = Date.now();
    this.curRUMSessionId = '';

    // Create native event listeners on this device
    const eventEmitter = new NativeEventEmitter(RaygunNativeBridge);
    eventEmitter.addListener(RaygunNativeBridge.ON_START, this.sendViewLoadedEvent.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_PAUSE, this.markLastActiveTime.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_RESUME, this.rotateRUMSession.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_DESTROY, () => {
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_START);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_PAUSE);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_RESUME);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_DESTROY);
    });
  }

  //#endregion--------------------------------------------------------------------------------------


  //#region ----RUM SESSION MANAGEMENT--------------------------------------------------------------

  /**
   * "Rotating" a RUM session is to close down the current session and open another. Instances where
   * a rotation is needed:
   *  anon_user -> user = NO (login)
   *  user1 -> user2 = YES (switch accounts)
   *  user -> anon = YES (logout)
   */
  async rotateRUMSession() {
    if (Date.now() - this.lastActiveAt > SessionRotateThreshold) {
      this.lastActiveAt = Date.now();
      await this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.SessionEnd, {});
      this.curRUMSessionId = getDeviceBasedId();
      return this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.SessionStart, {});
    }
  }

  /**
   * Updates the time since last activity to be NOW.
   */
  markLastActiveTime() {
    this.lastActiveAt = Date.now();
  };

  //#endregion--------------------------------------------------------------------------------------


  //#region ----RUM EVENT HANDLERS------------------------------------------------------------------

  /**
   * Enables the ability to send a custom RUM message. Utilizing the parameters described below,
   * each one is used in constructing a RUM message, which is ultimately fed to the transmitRealUserMonitoringEvent
   * method.
   * @param eventType - A small description of the event (used to categorize events)
   * @param name - The name of the event (makes the event individual from it's category)
   * @param duration - How long this event took to execute.
   */
  sendCustomRUMEvent(
    eventType: RealUserMonitoringAssetType.ViewLoaded | RealUserMonitoringAssetType.NetworkCall,
    name: string,
    duration: number
  ) {
    if (eventType === RealUserMonitoringAssetType.ViewLoaded) {
      this.sendViewLoadedEvent(name, duration);
      return;
    }
    if (eventType === RealUserMonitoringAssetType.NetworkCall) {
      this.sendNetworkTimingEvent(name, Date.now() - duration, duration);
      return;
    }
    warn('Unknown RUM event type:', eventType);
  }

  /**
   * Sends a RUMEvent with the parameters parsed into this method. Utilizing the JSON layout sent
   * to api.raygun.com, the name and duration are added as parameters to the "DATA" field in the
   * RUM message.
   * @param name - The event name (note this is not the event type), used in the "DATA" param of a
   * RUM message
   * @param sendTime - The time at which the event occurred.
   * @param duration - The time taken for this event to fully execute.
   */
  sendNetworkTimingEvent(name: string, sendTime: number, duration: number) {
    const data = { name, timing: { type: RealUserMonitoringAssetType.NetworkCall, duration } };
    this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.EventTiming, data, sendTime).catch();
  }

  /**
   * This method sends a mobile event timing message to the raygun server. If the current session
   * has not been setup, this method will also ensure that the session has been allocated an ID
   * before sending away any data.
   * @param name - Name of the event (specific to the event).
   * @param duration - How long the event took.
   */
  async sendViewLoadedEvent(name: string, duration: number) {
    if (!this.curRUMSessionId) {
      this.curRUMSessionId = getDeviceBasedId();
      await this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.SessionStart, {});
    }
    const data = { name, timing: { type: RealUserMonitoringAssetType.ViewLoaded, duration } };
    return this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.EventTiming, data);
  }

  /**
   * Sends a POST request to the custom || default RUM Endpoint, creating an object (later
   * JSON.stringify-ing this object) with the eventName, data, and time recorded in the message.
   * @param eventName - A custom name for the "TYPE" of RUM message
   * @param data - Extra information to send in the RUM message, under "DATA".
   * @param timeAt - The time at which this event occurred, defaults to NOW if undefined/null.
   */
  async transmitRealUserMonitoringEvent(eventName: string, data: Record<string, any>, timeAt?: number) {
    const timestamp = timeAt ? new Date(timeAt) : new Date();
    const rumMessage = {
      type: eventName,
      timestamp: timestamp.toISOString(),
      user: this.currentSession.user,
      sessionId: this.curRUMSessionId,
      version: this.version,
      os: Platform.OS,
      osVersion,
      platform,
      data: JSON.stringify([data])
    };

    return fetch(this.customRealUserMonitoringEndpoint || this.RAYGUN_RUM_ENDPOINT, {
      method: 'POST',
      headers: { 'X-ApiKey': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventData: [rumMessage] })
    }).catch(err => {
      log(err);
    });
  }

  //#endregion--------------------------------------------------------------------------------------

}
