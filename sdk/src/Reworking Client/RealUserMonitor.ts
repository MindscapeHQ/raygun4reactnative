import {BeforeSendHandler, NetworkTimingCallback, RUMEvents, User} from "../Types";
import { NativeModules, NativeEventEmitter } from 'react-native';
import {setupNetworkMonitoring} from "../NetworkMonitor";

const { RaygunNativeBridge } = NativeModules;
const { osVersion, platform } = RaygunNativeBridge;

const defaultURLIgnoreList = ['api.raygun.com', 'localhost:8081/symbolicate'];
const SessionRotateThreshold = 30 * 60 * 100;


export default class RealUserMonitor {

    private getCurrentUser: () => User;
    private enabled: boolean = false;
    private apiKey: string;
    private version: string;
    private enableRealUserMonitoring: boolean;
    private disableNetworkMonitoring: boolean;
    private customRealUserMonitoringEndpoint: string;
    private ignoredURLs: string[];

    private NetworkTimingEventCallback: NetworkTimingCallback;

    lastActiveAt = Date.now();
    curRUMSessionId: string = '';

    constructor(getCurrentUser: () => User, apiKey: string, disableNetworkMonitoring = true, ignoredURLs: string[], customRealUserMonitoringEndpoint: string
        ) {

        this.enabled = true;  //TODO

        this.NetworkTimingEventCallback = this.generateNetworkTimingEventCallbackMethod(getCurrentUser, apiKey, customRealUserMonitoringEndpoint);

        if (!disableNetworkMonitoring) {
            setupNetworkMonitoring(
                ignoredURLs.concat(defaultURLIgnoreList, customRealUserMonitoringEndpoint || []),
                this.NetworkTimingEventCallback
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

    /**
     * Create a callback method to forward network events on to RUM
     * @param getCurrentUser
     * @param apiKey
     * @param customRealUserMonitoringEndpoint
     */
    generateNetworkTimingEventCallbackMethod (getCurrentUser: () => User, apiKey: string, customRealUserMonitoringEndpoint?: string) : NetworkTimingCallback {

        let callbackMethod: NetworkTimingCallback = (name: string, sendTime: number, duration: number) => {
                    const data = { name, timing: { type: RUMEvents.NetworkCall, duration } };
                    this.sendRUMEvent(RUMEvents.EventTiming, getCurrentUser(), data, this.curRUMSessionId, apiKey, customRealUserMonitoringEndpoint, sendTime);
                };

        return callbackMethod;
    };

}
