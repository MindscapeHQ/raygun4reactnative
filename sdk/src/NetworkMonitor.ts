import { NetworkTimingCallback } from './Types';
//@ts-ignore
import XHRInterceptor from 'react-native/Libraries/Network/XHRInterceptor';
import {getDeviceBasedId, removeProtocol, shouldIgnore} from './Utils';
interface RequestMeta {
  name: string;
  sendTime?: number;
}

const requests = new Map<string, RequestMeta>();

const handleRequestOpen = (ignoredURLs: string[]) => (
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  xhr: any
) => {
  if (shouldIgnore(url, ignoredURLs)) {
    return;
  }
  const id = getDeviceBasedId();
  xhr._id_ = id;
  requests.set(id, { name: `${method} ${url}` });
};

const handleRequestSend = (data: string, xhr: any) => {
  const { _id_ } = xhr;
  const requestMeta = requests.get(_id_);
  if (requestMeta) {
    requestMeta.sendTime = Date.now();
  }
};

const handleResponse = (sendNetworkTimingEvent: NetworkTimingCallback) => (
  status: number,
  timeout: number,
  resp: string,
  respUrl: string,
  respType: string,
  xhr: any
) => {
  const { _id_ } = xhr;
  const requestMeta = requests.get(_id_);
  if (requestMeta) {
    const { name, sendTime } = requestMeta;
    const duration = Date.now() - sendTime!;
    sendNetworkTimingEvent(name, sendTime!, duration);
  }
};

export const setupNetworkMonitoring = (
  ignoredURLs: string[],
  sendNetworkTimingEvent: NetworkTimingCallback
) => {
  if (typeof sendNetworkTimingEvent === 'function') {
    const urls = ([] as string[]).concat(ignoredURLs || []).map(removeProtocol);
    XHRInterceptor.setOpenCallback(handleRequestOpen(urls));
    XHRInterceptor.setSendCallback(handleRequestSend);
    XHRInterceptor.setResponseCallback(handleResponse(sendNetworkTimingEvent));
    XHRInterceptor.enableInterception();
  }
};
