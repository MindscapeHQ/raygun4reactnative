import {
  RealUserMonitoringEvents,
  RealUserMonitoringTimings,
  RealUserMonitorPayload,
  RequestMeta,
  User
} from './Types';
import {getDeviceId, log, warn, shouldIgnore, getCurrentUser, getCurrentTags, getRandomGUID, error} from './Utils';
// @ts-ignore
import XHRInterceptor from 'react-native/Libraries/Network/XHRInterceptor';
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

  private apiKey: string;
  private version: string;
  private disableNetworkMonitoring: boolean;
  private ignoredURLs: string[];
  private requests = new Map<string, RequestMeta>();
  private raygunRumEndpoint = 'https://api.raygun.com/events';

  private loadingViews = new Map<string, number>();

  lastSessionInteractionTime = Date.now();
  RealUserMonitoringSessionId: string = ''; //The id for generated RUM Timing events to be grouped under

  /**
   * RealUserMonitor: Manages RUM specific logic tasks.
   * @param apiKey - The User's API key that gives them access to RUM. (User provided)
   * @param disableNetworkMonitoring - If true, XHRInterceptor is not switched on. All requests go through without monitoring.
   * @param ignoredURLs - A string array of URLs to ignore when watching the network.
   * @param customRealUserMonitoringEndpoint - The custom API URL endpoint where this API should send data to.
   * @param version - The Version number of this application. (User provided)
   */
  constructor(
    apiKey: string,
    disableNetworkMonitoring: boolean,
    ignoredURLs: string[],
    customRealUserMonitoringEndpoint: string,
    version: string
  ) {
    // Assign the values parsed in (assuming initiation is the only time these are altered).
    this.apiKey = apiKey;
    this.disableNetworkMonitoring = disableNetworkMonitoring;
    this.version = version;
    this.ignoredURLs = ignoredURLs.concat(defaultURLIgnoreList, customRealUserMonitoringEndpoint || []);

    if (customRealUserMonitoringEndpoint && customRealUserMonitoringEndpoint.length > 0){
      this.raygunRumEndpoint = customRealUserMonitoringEndpoint;
    }

    // If the USER has not defined disabling network monitoring, setup the XHRInterceptor (see
    // NetworkMonitor.ts).
    // If the USER has not defined disabling network monitoring, setup the XHRInterceptor
    if (!disableNetworkMonitoring) {
      this.setupNetworkMonitoring();
    }

    this.markSessionInteraction();
    this.RealUserMonitoringSessionId = '';

    // Create native event listeners on this device
    const eventEmitter = new NativeEventEmitter(RaygunNativeBridge);
    eventEmitter.addListener(RaygunNativeBridge.ON_SESSION_START, this.sessionStarted.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_SESSION_PAUSE, this.markSessionInteraction.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_SESSION_RESUME, this.rotateRUMSession.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_VIEW_LOADING, this.viewBeginsLoading.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_VIEW_LOADED, this.sendViewLoadedEvent.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_SESSION_END, () => {
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_SESSION_START);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_SESSION_PAUSE);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_SESSION_RESUME);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_VIEW_LOADING);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_VIEW_LOADED);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_SESSION_END);
    });
  }

  //#endregion--------------------------------------------------------------------------------------

  //#region ----RUM SESSION MANAGEMENT--------------------------------------------------------------

  /**
   * "Rotating" a RUM session is to close down the current session and open another. Instances where
   * a rotation is needed:
   *  anon_user -> user = NO (login)
   *  user1 -> user2 = YES (switch accounts)
   *  user -> anon_user = YES (logout)
   */
  async rotateRUMSession() {
    log('ROTATE RUM SESSION');

    //Terminate the current session
    await this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.SessionEnd, {});

    //Begin a new session
    this.generateNewSessionId();
    this.markSessionInteraction();
    return this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.SessionStart, {});
  }

  /**
   * Updates the session id to be a new random guid
   */
  generateNewSessionId() {
    this.RealUserMonitoringSessionId = getRandomGUID(32);
  }

  /**
   * Updates the time since last activity to be NOW.
   */
  markSessionInteraction() {
    this.lastSessionInteractionTime = Date.now();
  }

  /**
   * Generate the sessionID and transmit a sessionStarted event
   */
  sessionStarted() {
    this.generateNewSessionId();
    this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.SessionStart, {});
  }

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
  sendCustomRUMEvent(eventType: RealUserMonitoringTimings, name: string, duration: number) {
    if (eventType === RealUserMonitoringTimings.ViewLoaded) {
      this.sendViewLoadedEvent({ name, duration });
      return;
    }
    if (eventType === RealUserMonitoringTimings.NetworkCall) {
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
    const data = { name, timing: { type: RealUserMonitoringTimings.NetworkCall, duration } };
    this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.EventTiming, data, sendTime).catch();
  }

  viewBeginsLoading(payload: Record<string, any>) {
    const { viewname, time } = payload;

    log(`Storing view loading!!!!!  ${viewname} & ${time}`);

    if (this.loadingViews.has(viewname)) error(`${viewname} is already loading`);
    else {
      this.loadingViews.set(viewname, time);
      log(`Storing ${viewname} as loading!`)
    }
  }


  /**
   * This method sends a mobile event timing message to the raygun server. If the current session
   * has not been setup, this method will also ensure that the session has been allocated an ID
   * before sending away any data.
   * @param payload
   */
  async sendViewLoadedEvent(payload: Record<string, any>) {
    const { viewname, time } = payload;

    log(`sending View Loaded!!!!!  ${viewname} & ${time}`);

    if (this.loadingViews.has(viewname) && !!this.loadingViews.get(viewname)) {
      // @ts-ignore
      let duration : number = time - this.loadingViews.get(viewname);

      log(`View successfully read. duration: ${duration}`);

      this.loadingViews.delete(viewname);

      const data = { viewname, timing: { type: RealUserMonitoringTimings.ViewLoaded, duration } };
      return this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.EventTiming, data);
    }
    else error(`${viewname} never started loading!`);
  }

  //#endregion--------------------------------------------------------------------------------------

  //#region ----RUM PAYLOAD MANAGEMENT--------------------------------------------------------------

  generateRealUserMonitorPayload(
    eventName: string,
    data: Record<string, any>,
    timeAt?: number
  ): RealUserMonitorPayload {
    const timestamp = timeAt ? new Date(timeAt) : new Date();
    return {
      type: eventName,
      timestamp: timestamp.toISOString(),
      tags: getCurrentTags(),
      user: getCurrentUser(),
      sessionId: this.RealUserMonitoringSessionId,
      version: this.version,
      os: Platform.OS,
      osVersion,
      platform,
      data: JSON.stringify([data])
    };
  }

  /**
   * Sends a POST request to the custom || default RUM Endpoint, creating an object (later
   * JSON.stringify-ing this object) with the eventName, data, and time recorded in the message.
   * @param eventName - A custom name for the "TYPE" of RUM message
   * @param data - Extra information to send in the RUM message, under "DATA".
   * @param timeAt - The time at which this event occurred, defaults to NOW if undefined/null.
   */
  async transmitRealUserMonitoringEvent(eventName: string, data: Record<string, any>, timeAt?: number) {

    log(`Transmitting ${eventName} event to: ${this.raygunRumEndpoint}?apiKey=${encodeURIComponent(this.apiKey)}`);

    //Check whether the session has been idle long enough to rotate it
    if (Date.now() - this.lastSessionInteractionTime > SessionRotateThreshold) await this.rotateRUMSession();
    else this.markSessionInteraction();

    const rumMessage = this.generateRealUserMonitorPayload(eventName, data, timeAt);

    log(`RUM MESSAGE: ${JSON.stringify(rumMessage)}`)

    return fetch(this.raygunRumEndpoint + '?apiKey=' + encodeURIComponent(this.apiKey),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ eventData: [rumMessage] })
      }
    ).catch(err => {
      log(err);
    });
  }

  //#endregion--------------------------------------------------------------------------------------

  //#region ----NETWORK MONITORING------------------------------------------------------------------

  /**
   * This method returns a callback method to utilize in the XHRInterceptor.setOpenCallback method.
   * It determines the method request, url and XHRInterceptor specific for this device.
   * Using that information, this method will create an instance of this device to store for later data gathering.
   *
   * @param method
   * @param url
   * @param xhr
   */
  handleRequestOpen(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, xhr: any) {
    // If this URL is on the IGNORE list, then do nothing.
    if (shouldIgnore(url, this.ignoredURLs)) {
      return;
    }
    // Obtain the device ID
    const id = getDeviceId();

    // Set the ID of the XHRInterceptor to the device ID
    xhr._id_ = id;

    // Store the ID and the action taken on the device in a map, ID => REQUEST_META
    this.requests.set(id, { name: `${method} ${url}` });
  }

  /**
   * When the XHRInterceptor receives a send request, this method is called. It stores the current time in the relevant
   * device RequestMeta object (last known activity).
   * @param data - UNUSED.
   * @param xhr - The interceptor that picked up the send request.
   */
  handleRequestSend(data: string, xhr: any) {
    // Extract the XHRInterceptor's ID (also the Device's base ID). Use that to get the RequestMeta object from the map
    const { _id_ } = xhr;
    const requestMeta = this.requests.get(_id_);

    // If the object exists, then store the current time
    if (requestMeta) {
      requestMeta.sendTime = Date.now();
    }
  }

  /**
   * This method returns a callback method to utilize in the XHRInterceptor.setResponseCallback method.
   * Upon receiving a response, the XHRInterceptor calls this method. This method acts like an intermediate step for the
   * NetworkTimingCallback. Before calling the 'sendNetworkTimingEvent', this method finds the duration since this device
   * has last sent a request (called the handleRequestSend method above), and then it calls the 'sendNetworkTimingEvent'
   * parsing the name and sendTime from the RequestMeta along with the calculated duration (Time taken from request to
   * response).
   * @param status
   * @param timeout
   * @param resp
   * @param respUrl
   * @param respType
   * @param xhr
   */
  handleResponse(status: number, timeout: number, resp: string, respUrl: string, respType: string, xhr: any) {
    // Extract the XHRInterceptor's ID (also the Device's base ID). Use that to get the RequestMeta object from the map
    const { _id_ } = xhr;
    const requestMeta = this.requests.get(_id_);

    // If the object exists, then ...
    if (requestMeta) {
      // Extract the name and send time from the Request
      const { name, sendTime } = requestMeta;
      const duration = Date.now() - sendTime!;
      this.sendNetworkTimingEvent(name, sendTime!, duration);
    }
  }

  /**
   * Instantiates the Open, Send and Response callback methods for the XHRInterceptor.
   */
  setupNetworkMonitoring() {
    XHRInterceptor.setOpenCallback(this.handleRequestOpen.bind(this));
    XHRInterceptor.setSendCallback(this.handleRequestSend.bind(this));
    XHRInterceptor.setResponseCallback(this.handleResponse.bind(this));
    XHRInterceptor.enableInterception();
  }

  //#endregion--------------------------------------------------------------------------------------
}
