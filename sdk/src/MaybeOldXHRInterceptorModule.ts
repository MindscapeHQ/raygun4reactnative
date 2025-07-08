let XHRInterceptorModule: any = null;
try {
  XHRInterceptorModule = require('react-native/Libraries/Network/XHRInterceptor');
} catch {
  // Ignore error - module not available in this RN version
}
export default XHRInterceptorModule;
