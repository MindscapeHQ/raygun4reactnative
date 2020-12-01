import {BeforeSendHandler, NetworkTimingCallback, RUMEvents, User} from "../Types";
import {NativeModules, NativeEventEmitter, Platform} from 'react-native';
const { version: clientVersion } = require('../package.json');
import {setupNetworkMonitoring} from "../NetworkMonitor";
import {warn} from "../Utils";
import {sendRUMPayload} from "../Transport";

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



    sendCustomRUMEvent (
        getCurrentUser: () => User,
        apiKey: string,
        eventType: RUMEvents.ActivityLoaded | RUMEvents.NetworkCall,
        name: string,
        duration: number,
        customRealUserMonitoringEndpoint?: string
    ) {
        if (eventType === RUMEvents.ActivityLoaded) {
            reportStartupTime(getCurrentUser, apiKey)({ name, duration });
            return;
        }
        if (eventType === RUMEvents.NetworkCall) {
            this.NetworkTimingEventCallback(name, Date.now() - duration, duration);
            return;
        }
        warn('Unknown RUM event type:', eventType);
    };





    async sendRUMEvent (
        eventName: string,
        user: User,
        data: Record<string, any>,
        sessionId: string,
        apiKey: string,
        customRealUserMonitoringEndpoint?: string,
        timeAt?: number
    ){
        const timestamp = timeAt ? new Date(timeAt) : new Date();
        const rumMessage = {
            type: eventName,
            timestamp: timestamp.toISOString(),
            user,
            sessionId,
            version: clientVersion,
            os: Platform.OS,
            osVersion,
            platform,
            data: JSON.stringify([data])
        };
        return sendRUMPayload(rumMessage, apiKey, customRealUserMonitoringEndpoint);
    };

}
