import {
  BeforeSendHandler, BreadcrumbOption,
  CrashReportPayload, CustomData,
  RaygunClientOptions,
  RUMEvents,
  Session
} from "../Types";
import {getDeviceBasedId, log, warn} from "../Utils";
import {NativeModules} from "react-native";
import CrashReporter from "./CrashReporter";
import RealUserMonitor from "./RealUserMonitor";
import {sendCustomRUMEvent} from "../RealUserMonitoring";
import {generateCrashReportPayload} from "../RaygunClient";
import {StackFrame} from "react-native/Libraries/Core/Devtools/parseErrorStack";

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
    rum = new RealUserMonitor(getCurrentUser, apiKey, disableNetworkMonitoring, ignoredURLs, customRealUserMonitoringEndpoint, version);
  }
  //enable CR
  if (enableCrashReporting) {
    cr = new CrashReporter(curSession, apiKey, disableNetworkMonitoring, customCrashReportingEndpoint || '', onBeforeSendingCrashReport, version);
  }
  return true;
};


const generateCrashReportPayload = (error: Error, stackFrames: StackFrame[]) => {
  if (cr && CleanedOptions.enableCrashReporting) {
    cr.generateCrashReportPayload(error, stackFrames).then();
  } else {
    warn('TODO');
    return;
  }
};

const recordBreadcrumb = (message: string, details?: BreadcrumbOption) => {
  if (cr && CleanedOptions.enableCrashReporting) {
    cr.recordBreadcrumb(message, details);
  } else {
    warn('TODO');
    return;
  }
};

const sendCustomError = async (error: Error, ...params: any) => {
  if (cr && CleanedOptions.enableCrashReporting) {
    cr.sendCustomError(error, params);
  } else {
    warn('TODO');
    return;
  }
};

const addCustomData = (customData: CustomData) => {
  if (cr && CleanedOptions.enableCrashReporting) {
    cr.addCustomData(customData);
  } else {
    warn('TODO');
    return;
  }
}

const updateCustomData = (updater: (customData: CustomData) => CustomData) => {
  if (cr && CleanedOptions.enableCrashReporting) {
    cr.updateCustomData(updater);
  } else {
    warn('TODO');
    return;
  }
}

const sendRUMTimingEvent = (eventType: RUMEvents.ActivityLoaded | RUMEvents.NetworkCall, name: string, timeUsedInMs: number) => {
  if (rum && CleanedOptions.enableRealUserMonitoring) {
    rum.sendCustomRUMEvent(
      getCurrentUser,
      CleanedOptions.apiKey,
      eventType,
      name,
      timeUsedInMs,
      CleanedOptions.customRealUserMonitoringEndpoint
    );
  } else {
    warn('TODO');
    return;
  }
};


export {
  init,

  addTag,
  setUser,
  clearSession,
  filterOutReactFrames,
  noAddressAt,

  generateCrashReportPayload,
  recordBreadcrumb,
  addCustomData,
  sendCustomError,
  updateCustomData,

  sendRUMTimingEvent
};

