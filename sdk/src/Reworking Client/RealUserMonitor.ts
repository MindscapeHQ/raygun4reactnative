import {BeforeSendHandler, RaygunClientOptions, User} from "../Types";
import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

const { RaygunNativeBridge } = NativeModules;
const { osVersion, platform } = RaygunNativeBridge;

const defaultURLIgnoreList = ['api.raygun.com', 'localhost:8081/symbolicate'];
const SessionRotateThreshold = 30 * 60 * 100;


export default class RealUserMonitor {

    private enabled: boolean = false;
    private apiKey: string;
    private version: string;
    private enableCrashReporting: boolean;
    private disableNativeCrashReporting: boolean;
    private enableRealUserMonitoring: boolean;
    private disableNetworkMonitoring: boolean;
    private customCrashReportingEndpoint: string;
    private customRealUserMonitoringEndpoint: string;
    private onBeforeSendingCrashReport: BeforeSendHandler;
    private ignoredURLs: string[];

    lastActiveAt = Date.now();
    curRUMSessionId: string = '';

    constructor(
        getCurrentUser: () => User,
        apiKey: string,
        disableNetworkMonitoring = true,
        ignoredURLs = [] as string[],
        customRealUserMonitoringEndpoint: string
        ) {

        this.enabled = true;  //TODO

        if (!disableNetworkMonitoring) {
            setupNetworkMonitoring(
                ignoredURLs.concat(defaultURLIgnoreList, customRealUserMonitoringEndpoint || []),
                sendNetworkTimingEvent(getCurrentUser, apiKey, customRealUserMonitoringEndpoint)
            );
        }

        this.lastActiveAt = Date.now();
        this.curRUMSessionId = '';

        const eventEmitter = new NativeEventEmitter(RaygunNativeBridge);
        eventEmitter.addListener(RaygunNativeBridge.ON_START, reportStartupTime(getCurrentUser, apiKey, customRealUserMonitoringEndpoint));
        eventEmitter.addListener(RaygunNativeBridge.ON_PAUSE, markLastActiveTime);
        eventEmitter.addListener(RaygunNativeBridge.ON_RESUME, rotateRUMSession(getCurrentUser, apiKey, customRealUserMonitoringEndpoint));
        eventEmitter.addListener(RaygunNativeBridge.ON_DESTROY, () => {
            eventEmitter.removeAllListeners(RaygunNativeBridge.ON_START);
            eventEmitter.removeAllListeners(RaygunNativeBridge.ON_PAUSE);
            eventEmitter.removeAllListeners(RaygunNativeBridge.ON_RESUME);
            eventEmitter.removeAllListeners(RaygunNativeBridge.ON_DESTROY);
        });

        // Assign the values parsed in (assuming initiation is the only time these are altered).
        this.apiKey = apiKey;
        this.disableNetworkMonitoring = disableNetworkMonitoring;
        this.ignoredURLs = ignoredURLs;
        this.customRealUserMonitoringEndpoint = customRealUserMonitoringEndpoint;
    };
}
