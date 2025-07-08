let XHRInterceptorModule: any = null;
try {
   XHRInterceptorModule = require('react-native/src/private/inspector/XHRInterceptor');
} catch {}
export default XHRInterceptorModule;