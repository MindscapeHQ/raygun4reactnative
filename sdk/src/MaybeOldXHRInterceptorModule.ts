let XHRInterceptorModule: any = null;
try {
  XHRInterceptorModule = require('react-native/Libraries/Network/XHRInterceptor');
} catch {}
export default XHRInterceptorModule;
