import { RealUserMonitoringEvents, RealUserMonitoringTimings, RealUserMonitorPayload, RequestMeta } from './Types';
import { getCurrentUser, getCurrentTags, getRandomGUID } from './Utils';
import { v4 as uuidv4 } from 'uuid';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import RaygunLogger from './RaygunLogger';

const { RaygunNativeBridge } = NativeModules;
const { osVersion, platform } = RaygunNativeBridge; 

import OldXHRInterceptorModule from './MaybeOldXHRInterceptorModule'; 
import NewXHRInterceptorModule from './MaybeNewXHRInterceptorModule';
const XHRInterceptorModule = NewXHRInterceptorModule ?? OldXHRInterceptorModule;

// Attempt to require XHRInterceptor using dynamic paths
// let XHRInterceptorModule: any;
// TODO: Uncomment when RN 0.81 is released
// try {
//   // Try the new path first (for RN >= 0.79)
//   // https://github.com/facebook/react-native/releases/tag/v0.79.0#:~:text=APIs%3A%20Move-,XHRInterceptor,-API%20to%20src
//   XHRInterceptorModule = require('react-native/src/private/inspector/XHRInterceptor');
// } catch (e) {
//   try {
//     // Fallback to the old path (for RN < 0.79)
//     XHRInterceptorModule = require('react-native/Libraries/Network/XHRInterceptor');
//   } catch (e) {
//     RaygunLogger.w('Failed to load XHRInterceptor, network monitoring will be disabled', e);
//     XHRInterceptorModule = null;
//   }
// }

let XHRInterceptor: any;
if (XHRInterceptorModule) {
  // Check if methods are directly on the module
  if (
    typeof XHRInterceptorModule.setOpenCallback === 'function' &&
    typeof XHRInterceptorModule.setSendCallback === 'function' &&
    typeof XHRInterceptorModule.setResponseCallback === 'function' &&
    typeof XHRInterceptorModule.enableInterception === 'function'
  ) {
    XHRInterceptor = XHRInterceptorModule;
  }
  // Check if methods are on the default export
  else if (
    XHRInterceptorModule.default &&
    typeof XHRInterceptorModule.default.setOpenCallback === 'function' &&
    typeof XHRInterceptorModule.default.setSendCallback === 'function' &&
    typeof XHRInterceptorModule.default.setResponseCallback === 'function' &&
    typeof XHRInterceptorModule.default.enableInterception === 'function'
  ) {
    XHRInterceptor = XHRInterceptorModule.default;
  }
}

// If still no valid XHRInterceptor after checking module and module.default, assign the dummy
if (!XHRInterceptor) {
  if (XHRInterceptorModule) {
    RaygunLogger.e('Required XHRInterceptor module does not have expected methods.');
    RaygunLogger.w('Network monitoring will be disabled.');
  }
  XHRInterceptor = {
    setOpenCallback: () => { },
    setSendCallback: () => { },
    setResponseCallback: () => { },
    enableInterception: () => { }
  };
}

const defaultURLIgnoreList: string[] = ['api.raygun.com', 'localhost:8081'];
const defaultViewIgnoreList: string[] = []; // Nothing as of right now
const SessionRotateThreshold = 30 * 60 * 1000; // milliseconds (equivalent to 30 minutes)

/**
 * The Real User Monitor class is responsible for managing all logic for RUM specific tasks.
 */
export default class RealUserMonitor {
  private apiKey: string;
  private version: string;
  private disableNetworkMonitoring: boolean;
  private ignoredURLs: string[];
  private ignoredViews: string[];
  private requests = new Map<string, RequestMeta>();
  private raygunRumEndpoint = 'https://api.raygun.com/events';

  private loadingViews = new Map<string, number>();

  lastSessionInteractionTime = Date.now();
  RealUserMonitoringSessionId: string = ''; // The id for generated RUM Timing events to be grouped under

  /**
   * RealUserMonitor: Manages RUM specific logic tasks.
   * @param {string} apiKey - The User's API key that gives them access to RUM. (User provided).
   * @param {boolean} disableNetworkMonitoring - If true, XHRInterceptor is not switched on. All requests go through without monitoring.
   * @param {sting[]} ignoredURLs - A string array of URLs to ignore when watching the network.
   * @param {string[]} ignoredViews - A string array of all the view names to ignore logging.
   * @param {string} customRealUserMonitoringEndpoint - The custom API URL endpoint where this API should send data to.
   * @param {string} version - The Version number of this application. (User provided).
   */
  constructor(
    apiKey: string,
    disableNetworkMonitoring: boolean,
    ignoredURLs: string[],
    ignoredViews: string[],
    customRealUserMonitoringEndpoint: string,
    version: string
  ) {
    // Assign the values parsed in (assuming initiation is the only time these are altered)
    this.apiKey = apiKey;
    this.disableNetworkMonitoring = disableNetworkMonitoring;
    this.version = version;
    this.ignoredURLs = ignoredURLs.concat(defaultURLIgnoreList, customRealUserMonitoringEndpoint || []);
    this.ignoredViews = ignoredViews.concat(defaultViewIgnoreList);

    if (customRealUserMonitoringEndpoint && customRealUserMonitoringEndpoint.length > 0) {
      this.raygunRumEndpoint = customRealUserMonitoringEndpoint;
    }

    if (!disableNetworkMonitoring) {
      this.setupNetworkMonitoring();
    }

    // Create native event listeners on this device
    const eventEmitter = new NativeEventEmitter(RaygunNativeBridge);
    eventEmitter.addListener(RaygunNativeBridge.ON_SESSION_PAUSE, this.markSessionInteraction.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_SESSION_RESUME, this.sessionResumed.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_VIEW_LOADING, this.viewBeginsLoading.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_VIEW_LOADED, this.viewFinishesLoading.bind(this));
    eventEmitter.addListener(RaygunNativeBridge.ON_SESSION_END, () => {
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_SESSION_PAUSE);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_SESSION_RESUME);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_VIEW_LOADING);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_VIEW_LOADED);
      eventEmitter.removeAllListeners(RaygunNativeBridge.ON_SESSION_END);
    });

    // Begin a Real User Monitoring session
    this.generateNewSessionId();
    this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.SessionStart, {});
  }

  /**
   * "Rotating" a RUM session is to close down the current session and open another. Instances where
   * a rotation is needed:
   *  anon_user -> user = NO (login)
   *  user1 -> user2 = YES (switch accounts)
   *  user -> anon_user = YES (logout)
   */
  async rotateRUMSession() {
    // Terminate the current session
    await this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.SessionEnd, {});

    // Begin a new session
    this.generateNewSessionId();

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
   * Ensures RUM generates a new session after a period of app inactivity.
   */
  async sessionResumed() {
    if (Date.now() - this.lastSessionInteractionTime > SessionRotateThreshold) {
      await this.rotateRUMSession();
    } else {
      this.markSessionInteraction();
    }
  }

  /**
   * When a View begins loading this event will store the time that it started so that the duration
   * can be calculated later.
   * @param {Record<string, any>} payload - The event information.
   */
  viewBeginsLoading(payload: Record<string, any>) {
    const { viewname, time } = payload;

    RaygunLogger.d(`View started loading ${viewname}`);

    if (this.loadingViews.has(viewname)) return;
    else {
      this.loadingViews.set(viewname, time);
    }
  }

  /**
   * When a View completes loading its load duration will be calculated using the load start time before
   * being cleaned and transmitted to raygun.
   * @param {Record<string, any>} payload - The event information.
   */
  viewFinishesLoading(payload: Record<string, any>) {
    const { viewname, time } = payload;

    RaygunLogger.d(`View finished loading: ${viewname}`);

    if (this.loadingViews.has(viewname)) {
      const viewLoadStartTime = this.loadingViews.get(viewname);
      if (viewLoadStartTime) {
        const duration: number = Math.round(time - viewLoadStartTime);

        this.loadingViews.delete(viewname);

        this.sendViewLoadedEvent(this.cleanViewName(viewname), duration);
      } else {
        RaygunLogger.d(`Loading views cannot have an undefined start time: ${viewname}`);
      }
    }
  }

  /**
   * Take in a viewname from the native side and clean it depending on the platform it came from.
   * @param {string} viewname
   * @return {string} The sanitised name that is ready for the RUM payload
   */
  cleanViewName(viewname: string): string {
    let cleanedViewName = viewname;
    if (cleanedViewName.startsWith('iOS_View: ')) {
      cleanedViewName = cleanedViewName.replace('iOS_View: ', '');
      cleanedViewName = cleanedViewName.replace('<', '');
      cleanedViewName = cleanedViewName.replace('>', '');
      cleanedViewName = cleanedViewName.split(':')[0];
    }
    return cleanedViewName;
  }

  /**
   * Enables the ability to send a custom RUM message. Utilizing the parameters described below,
   * each one is used in constructing a RUM message, which is ultimately fed to the transmitRealUserMonitoringEvent
   * method.
   * @param {RealUserMonitoringTimings} eventType - A small description of the event (used to categorize events).
   * @param {string} name - The name of the event (makes the event individual from it's category).
   * @param {number} duration - How long this event took to execute.
   */
  sendCustomRUMEvent(eventType: RealUserMonitoringTimings, name: string, duration: number) {
    if (eventType === RealUserMonitoringTimings.ViewLoaded) {
      this.sendViewLoadedEvent(name, duration);
      return;
    }
    if (eventType === RealUserMonitoringTimings.NetworkCall) {
      this.sendNetworkTimingEvent(name, Date.now() - duration, duration);
      return;
    }
  }

  /**
   * Sends a RUMEvent with the parameters parsed into this method. Utilizing the JSON layout sent
   * to api.raygun.com, the name and duration are added as parameters to the "DATA" field in the
   * RUM message.
   * @param {string} name - The event name (note this is not the event type), used in the "DATA" param of a RUM message.
   * @param {number} sendTime - The time at which the event occurred.
   * @param {number} duration - The time taken for this event to fully execute.
   */
  sendNetworkTimingEvent(name: string, sendTime: number, duration: number) {
    if (this.shouldIgnoreURL(name)) {
      return;
    }

    const data = { name, timing: { type: RealUserMonitoringTimings.NetworkCall, duration } };
    this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.EventTiming, data, sendTime).catch();
  }

  /**
   * This method sends a mobile event timing message to the raygun server. If the current session
   * has not been setup, this method will also ensure that the session has been allocated an ID
   * before sending away any data.
   * @param {string} name - The event name (note this is not the event type), used in the "DATA" param of a RUM message.
   * @param {number} duration - The time taken for this event to fully execute.
   */
  async sendViewLoadedEvent(name: string, duration: number) {
    if (this.shouldIgnoreView(name)) {
      return;
    }
    const data = { name: name, timing: { type: RealUserMonitoringTimings.ViewLoaded, duration } };

    return this.transmitRealUserMonitoringEvent(RealUserMonitoringEvents.EventTiming, data);
  }

  /**
   * Construct the RUM payload to transmit given the events information.
   * @param {string} eventName - A custom name for the "TYPE" of RUM message.
   * @param {Record<string, any>} data - Extra information to send in the RUM message, under "DATA".
   * @param {number} timeAt - The time at which this event occurred, defaults to NOW if undefined/null.
   * @return {RealUserMonitorPayload} The RUM payload object that can be serialised and sent.
   */
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
   * @param {string} eventName - A custom name for the "TYPE" of RUM message.
   * @param {Record<string, any>} data - Extra information to send in the RUM message, under "DATA".
   * @param {number} timeAt - The time at which this event occurred, defaults to NOW if undefined/null.
   */
  async transmitRealUserMonitoringEvent(eventName: string, data: Record<string, any>, timeAt?: number) {
    this.markSessionInteraction();

    const rumMessage = this.generateRealUserMonitorPayload(eventName, data, timeAt);

    RaygunLogger.v('Transmitting Real User Monitoring Payload', {
      Name: eventName,
      URL: this.raygunRumEndpoint + '?apiKey=' + encodeURIComponent(this.apiKey),
      Value: JSON.stringify(rumMessage)
    });

    return fetch(this.raygunRumEndpoint + '?apiKey=' + encodeURIComponent(this.apiKey), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ eventData: [rumMessage] })
    }).catch(err => {
      RaygunLogger.e('Unable to send Real User Monitor payload', err);
    });
  }

  /**
   * This method returns a callback method to utilize in the XHRInterceptor.setOpenCallback method.
   * It determines the method request, url and XHRInterceptor specific for this device.
   * Using that information, this method will create an instance of this device to store for later data gathering.
   *
   * @param {string} method - The request operation being performed.
   * @param {string} url - The destination this request is reaching.
   * @param {any} xhr - The interceptor that picked up the request.
   */
  handleRequestOpen(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, xhr: any) {
    // If this URL is on the IGNORE list, then do nothing.
    if (this.shouldIgnoreURL(url)) {
      return;
    }

    // Create a unique ID for this request
    const id = uuidv4();

    // Set the ID of the XHRInterceptor to the unique ID
    xhr._id_ = id;
    // Store the ID and the action taken on the device in a map, ID => REQUEST_META
    this.requests.set(id, { name: `${method} ${url}` });
  }

  /**
   * When the XHRInterceptor receives a send request, this method is called. It stores the current time in the relevant
   * device RequestMeta object (last known activity).
   * @param {string} data - UNUSED.
   * @param {any} xhr - The interceptor that picked up the send request.
   */
  handleRequestSend(data: string, xhr: any) {
    // Extract the XHRInterceptor's ID. Use that to get the RequestMeta object from the map
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
   * @param {number} status
   * @param {number} timeout
   * @param {string} resp
   * @param {string} respUrl
   * @param {string} respType
   * @param {any} xhr
   */
  handleResponse(status: number, timeout: number, resp: string, respUrl: string, respType: string, xhr: any) {
    // Extract the XHRInterceptor's ID. Use that to get the RequestMeta object from the map
    const { _id_ } = xhr;
    const requestMeta = this.requests.get(_id_);

    // If the object exists, then ...
    if (requestMeta) {
      // Extract the name and send time from the Request
      const { name, sendTime } = requestMeta;
      const duration = Date.now() - sendTime!;
      this.sendNetworkTimingEvent(name, sendTime!, duration);
      // Remove the request from the map
      this.requests.delete(_id_);
    }
  }

  /**
   * Instantiates the Open, Send and Response callback methods for the XHRInterceptor.
   */
  setupNetworkMonitoring() {
    if (!XHRInterceptor) {
      RaygunLogger.e('XHRInterceptor is not available, network monitoring will be disabled');
      return;
    }

    XHRInterceptor.setOpenCallback(this.handleRequestOpen.bind(this));
    XHRInterceptor.setSendCallback(this.handleRequestSend.bind(this));
    XHRInterceptor.setResponseCallback(this.handleResponse.bind(this));
    XHRInterceptor.enableInterception();
  }

  shouldIgnoreURL(url: string): boolean {
    for (let i = 0; i < this.ignoredURLs.length; i++) {
      if (url.includes(this.ignoredURLs[i])) {
        return true;
      }
    }
    return false;
  }

  shouldIgnoreView(name: string): boolean {
    for (let i = 0; i < this.ignoredViews.length; i++) {
      if (name.includes(this.ignoredViews[i])) {
        return true;
      }
    }
    return false;
  }
}
