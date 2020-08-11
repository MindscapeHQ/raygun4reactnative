import { v4 as uuidv4 } from 'uuid';
import { NetworkTimingCallback } from './types';
//@ts-ignore
import XHRInterceptor from 'react-native/Libraries/Network/XHRInterceptor';

interface RequestMeta {
  name: string;
  sendTime?: number;
}

const requests = new Map<string, RequestMeta>();

const removeProtocol = (url: string) => url.replace(/^http(s)?:\/\//i, '');

const shouldIgnore = (url: string, ignoreURLs: string[]): boolean => {
  const target = removeProtocol(url);
  return ignoreURLs.some(ignored => target.startsWith(ignored));
};

const handleRequestOpen = (ignoreURLs: string[]) => (
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  xhr: any
) => {
  if (shouldIgnore(url, ignoreURLs)) {
    return;
  }
  xhr._id_ = uuidv4();
  requests.set('_id_', { name: `${method} ${url}` });
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
  ignoreURLs: string[],
  sendNetworkTimingEvent: (name: string, sendTime: number, duration: number) => void
) => {
  if (typeof sendNetworkTimingEvent === 'function') {
    const urls = ([] as string[]).concat(ignoreURLs || []).map(removeProtocol);
    XHRInterceptor.setOpenCallback(handleRequestOpen(urls));
    XHRInterceptor.setSendCallback(handleRequestSend);
    XHRInterceptor.setResponseCallback(handleResponse(sendNetworkTimingEvent));
    XHRInterceptor.enableInterception();
  }
};
