import {BeforeSendHandler, CrashReportPayload, RaygunClientOptions, Session} from "../Types";
import {getDeviceBasedId, log} from "../Utils";
import {NativeModules} from "react-native";
import CrashReporter from "./CrashReporter";
import RealUserMonitor from "./RealUserMonitor";

const {RaygunNativeBridge} = NativeModules;

let cr: CrashReporter;
let rum: RealUserMonitor;

const getCleanSession = (): Session => ({
  tags: new Set(['React Native']),
  customData: {},
  breadcrumbs: [],
  user: {
    identifier: `anonymous-${getDeviceBasedId()}`
  }
});

const curSession = getCleanSession();
const getCurrentUser = () => curSession.user;

let CleanedOptions: RaygunClientOptions;

const init = async (options: RaygunClientOptions) => {

  //Cleans options with defaults
  const {
    apiKey = '',
    version = '',
    enableCrashReporting = false,
    disableNativeCrashReporting = false,
    enableRealUserMonitoring = false,
    disableNetworkMonitoring = false,
    customCrashReportingEndpoint = '',
    customRealUserMonitoringEndpoint = '',
    onBeforeSendingCrashReport = null,
    ignoredURLs = []
  } = CleanedOptions;

  //Check if native bridge is available and enabled
  const useNativeCR = !disableNativeCrashReporting && RaygunNativeBridge && typeof RaygunNativeBridge.init === 'function';

  //Has the client already been initialised
  const alreadyInitialized = useNativeCR && (await RaygunNativeBridge.hasInitialized());
  if (alreadyInitialized) {
    log('Already initialized');
    return false;
  }

  //Initialise if a service is being utilised
  if (useNativeCR || enableRealUserMonitoring) {
    RaygunNativeBridge.init({
      apiKey,
      enableRealUserMonitoring,
      version,
      customCrashReportingEndpoint
    });
  }
  //Enable rum
  if (enableRealUserMonitoring) {
    rum = new RealUserMonitor(getCurrentUser, apiKey, disableNetworkMonitoring, ignoredURLs, customRealUserMonitoringEndpoint);
  }
  //enable CR
  if (enableCrashReporting) {
    cr = new CrashReporter(curSession, apiKey, disableNetworkMonitoring, customCrashReportingEndpoint || '', onBeforeSendingCrashReport);
  }
  return true;
};


export {
  init,
  addTag,
  setUser,
  addCustomData,
  clearSession,
  updateCustomData,
  recordBreadcrumb,
  filterOutReactFrames,
  noAddressAt,
  generateCrashReportPayload,
  sendRUMTimingEvent,
  sendCustomError
};
