import {NetworkTimingCallback, RUMEvents, User} from "../Types";
import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import {setupNetworkMonitoring} from "../NetworkMonitor";
import {getDeviceBasedId, warn} from "../Utils";
import {sendRUMPayload} from "../Transport";

const { version: clientVersion } = require('../package.json');

const { RaygunNativeBridge } = NativeModules;
const { osVersion, platform } = RaygunNativeBridge;

const defaultURLIgnoreList = ['api.raygun.com', 'localhost:8081/symbolicate'];
const SessionRotateThreshold = 30 * 60 * 100;


export default class RealUserMonitor {

    private readonly getCurrentUser: () => User;
    private enabled: boolean = false;
    private readonly apiKey: string;
    // private version: string;
    // private enableRealUserMonitoring: boolean;
    private disableNetworkMonitoring: boolean;
    private readonly customRealUserMonitoringEndpoint: string;
    private ignoredURLs: string[];
    private readonly NetworkTimingEventCallback: NetworkTimingCallback;

    lastActiveAt = Date.now();
    curRUMSessionId: string = '';

    constructor(getCurrentUser: () => User, apiKey: string, disableNetworkMonitoring = true, ignoredURLs: string[], customRealUserMonitoringEndpoint: string
        ) {

        this.enabled = true;  //TODO

        this.NetworkTimingEventCallback = this.generateNetworkTimingEventCallbackMethod();

        if (!disableNetworkMonitoring) {
            setupNetworkMonitoring(
                ignoredURLs.concat(defaultURLIgnoreList, customRealUserMonitoringEndpoint || []),
                this.NetworkTimingEventCallback
            );
        }

        this.lastActiveAt = Date.now();
        this.curRUMSessionId = '';

        const eventEmitter = new NativeEventEmitter(RaygunNativeBridge);
        eventEmitter.addListener(RaygunNativeBridge.ON_START, this.reportStartupTime(getCurrentUser, apiKey, customRealUserMonitoringEndpoint));
        eventEmitter.addListener(RaygunNativeBridge.ON_PAUSE, this.markLastActiveTime);
        eventEmitter.addListener(RaygunNativeBridge.ON_RESUME, this.rotateRUMSession(getCurrentUser, apiKey, customRealUserMonitoringEndpoint));
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
        this.getCurrentUser = getCurrentUser;
    };

    /**
     * Create a callback method to forward network events on to RUM
     * @param getCurrentUser
     * @param apiKey
     * @param customRealUserMonitoringEndpoint
     */
    generateNetworkTimingEventCallbackMethod = () => (name: string, sendTime: number, duration: number) => {
            const data = {name, timing: {type: RUMEvents.NetworkCall, duration}};
            this.sendRUMEvent(RUMEvents.EventTiming, this.getCurrentUser(), data, this.curRUMSessionId, this.apiKey, this.customRealUserMonitoringEndpoint, sendTime);
    };



    reportStartupTime = (getCurrentUser: () => User, apiKey: string, customRealUserMonitoringEndpoint?: string) => async (
        payload: Record<string, any>
    ) => {
        const { duration, name } = payload;
        if (!this.curRUMSessionId) {
            this.curRUMSessionId = getDeviceBasedId();
            await this.sendRUMEvent(RUMEvents.SessionStart, getCurrentUser(), {}, this.curRUMSessionId, apiKey, customRealUserMonitoringEndpoint);
        }
        const data = { name, timing: { type: RUMEvents.ActivityLoaded, duration } };
        return this.sendRUMEvent(RUMEvents.EventTiming, getCurrentUser(), data, this.curRUMSessionId, apiKey, customRealUserMonitoringEndpoint);
    };

    markLastActiveTime = async () => {
        this.lastActiveAt = Date.now();
    };


    rotateRUMSession = (getCurrentUser: () => User, apiKey: string, customRealUserMonitoringEndpoint?: string) => async (
        payload: Record<string, any>
    ) => {
        if (Date.now() - this.lastActiveAt > SessionRotateThreshold) {
            this.lastActiveAt = Date.now();
            await this.sendRUMEvent(RUMEvents.SessionEnd, getCurrentUser(), {}, this.curRUMSessionId, apiKey, customRealUserMonitoringEndpoint);
            this.curRUMSessionId = getDeviceBasedId();
            return this.sendRUMEvent(RUMEvents.SessionStart, getCurrentUser(), {}, this.curRUMSessionId, apiKey, customRealUserMonitoringEndpoint);
        }
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



    sendCustomRUMEvent (
        getCurrentUser: () => User,
        apiKey: string,
        eventType: RUMEvents.ActivityLoaded | RUMEvents.NetworkCall,
        name: string,
        duration: number,
        customRealUserMonitoringEndpoint?: string
    ) {
        if (eventType === RUMEvents.ActivityLoaded) {
            this.reportStartupTime(getCurrentUser, apiKey)({ name, duration });
            return;
        }
        if (eventType === RUMEvents.NetworkCall) {
            this.NetworkTimingEventCallback(name, Date.now() - duration, duration);
            return;
        }
        warn('Unknown RUM event type:', eventType);
    };

}
