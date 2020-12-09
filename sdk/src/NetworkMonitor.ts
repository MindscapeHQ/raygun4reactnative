import { NetworkTimingCallback, RequestMeta } from './Types';
//@ts-ignore
import XHRInterceptor from 'react-native/Libraries/Network/XHRInterceptor';
import { getDeviceBasedId, removeProtocol, shouldIgnore } from './Utils';

const requests = new Map<string, RequestMeta>();

/**
 * This method returns a callback method to utilize in the XHRInterceptor.setOpenCallback method.
 * It determines the method request, url and XHRInterceptor specific for this device.
 * Using that information, this method will create an instance of this device to store for later data gathering.
 *
 * @param ignoredURLs - A string array of URLs to ignore
 */
const handleRequestOpen = (ignoredURLs: string[]) => (
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  xhr: any
) => {
  // If this URL is on the IGNORE list, then do nothing.
  if (shouldIgnore(url, ignoredURLs)) {
    return;
  }
  // Obtain the device ID
  const id = getDeviceBasedId();
  // Set the ID of the XHRInterceptor to the device ID
  xhr._id_ = id;
  // Store the ID and the action taken on the device in a map, ID => REQUEST_META
  requests.set(id, { name: `${method} ${url}` });

  /* NOTE, The method requires the ignoredURLs. Which is parsed into the RealUserMonitor and then parsed to the
     setupNetworkMonitoring method. For this reason, the method declaration used here is needed. */
};

/**
 * When the XHRInterceptor receives a send request, this method is called. It stores the current time in the relevant
 * device RequestMeta object (last known activity).
 * @param data - UNUSED.
 * @param xhr - The interceptor that picked up the send request.
 */
const handleRequestSend = (data: string, xhr: any) => {
  // Extract the XHRInterceptor's ID (also the Device's base ID). Use that to get the RequestMeta object from the map
  const { _id_ } = xhr;
  const requestMeta = requests.get(_id_);

  // If the object exists, then store the current time
  if (requestMeta) {
    requestMeta.sendTime = Date.now();
  }
};

/**
 * This method returns a callback method to utilize in the XHRInterceptor.setResponseCallback method.
 * Upon receiving a response, the XHRInterceptor calls this method. This method acts like an intermediate step for the
 * NetworkTimingCallback. Before calling the 'sendNetworkTimingEvent', this method finds the duration since this device
 * has last sent a request (called the handleRequestSend method above), and then it calls the 'sendNetworkTimingEvent'
 * parsing the name and sendTime from the RequestMeta along with the calculated duration (Time taken from request to
 * response).
 * @param sendNetworkTimingEvent - A NetworkTimingCallback method.
 */
const handleResponse = (sendNetworkTimingEvent: NetworkTimingCallback) => (
  status: number,
  timeout: number,
  resp: string,
  respUrl: string,
  respType: string,
  xhr: any
) => {
  // Extract the XHRInterceptor's ID (also the Device's base ID). Use that to get the RequestMeta object from the map
  const { _id_ } = xhr;
  const requestMeta = requests.get(_id_);

  // If the object exists, then ...
  if (requestMeta) {
    // Extract the name and send time from the Request
    const { name, sendTime } = requestMeta;
    const duration = Date.now() - sendTime!;
    sendNetworkTimingEvent(name, sendTime!, duration);
  }
};

/**
 * Instantiates the Open, Send and Response callback methods for the XHRInterceptor.
 * @param ignoredURLs - A string array of URLs to ignore.
 * @param sendNetworkTimingEvent - A NetworkTimingCallback method.
 */
export const setupNetworkMonitoring = (ignoredURLs: string[], sendNetworkTimingEvent: NetworkTimingCallback) => {
  if (typeof sendNetworkTimingEvent === 'function') {
    const urls = ([] as string[]).concat(ignoredURLs || []).map(removeProtocol);
    XHRInterceptor.setOpenCallback(handleRequestOpen(urls));
    XHRInterceptor.setSendCallback(handleRequestSend);
    XHRInterceptor.setResponseCallback(handleResponse(sendNetworkTimingEvent));
    XHRInterceptor.enableInterception();
  }
};
