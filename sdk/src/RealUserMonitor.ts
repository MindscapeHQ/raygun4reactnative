import {RUMEvents, User} from "./Types";
import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import {setupNetworkMonitoring} from "./NetworkMonitor";
import {getDeviceBasedId, log, warn} from "./Utils";


const {RaygunNativeBridge} = NativeModules;
const {osVersion, platform} = RaygunNativeBridge;

const defaultURLIgnoreList = ['api.raygun.com', 'localhost:8081/symbolicate'];
const SessionRotateThreshold = 30 * 60 * 100;


export default class RealUserMonitor {

    private getCurrentUser: () => User;
    private apiKey: string;
    private version: string;
    private disableNetworkMonitoring: boolean;
    private customRealUserMonitoringEndpoint: string;
    private ignoredURLs: string[];
    private RAYGUN_RUM_ENDPOINT = 'https://api.raygun.com/events';

    lastActiveAt = Date.now();
    curRUMSessionId: string = '';

    constructor(getCurrentUser: () => User, apiKey: string, disableNetworkMonitoring = true, ignoredURLs: string[], customRealUserMonitoringEndpoint: string, version: string) {

        // Assign the values parsed in (assuming initiation is the only time these are altered).
        this.apiKey = apiKey;
        this.disableNetworkMonitoring = disableNetworkMonitoring;
        this.ignoredURLs = ignoredURLs;
        this.customRealUserMonitoringEndpoint = customRealUserMonitoringEndpoint;
        this.getCurrentUser = getCurrentUser;
        this.version = version;

        if (!disableNetworkMonitoring) {
            setupNetworkMonitoring(
                ignoredURLs.concat(defaultURLIgnoreList, customRealUserMonitoringEndpoint || []),
                this.generateNetworkTimingEventCallbackMethod.bind(this)
            );
        }

        this.lastActiveAt = Date.now();
        this.curRUMSessionId = '';

        const eventEmitter = new NativeEventEmitter(RaygunNativeBridge);
        eventEmitter.addListener(RaygunNativeBridge.ON_START, this.reportStartupTime.bind(this));
        eventEmitter.addListener(RaygunNativeBridge.ON_PAUSE, this.markLastActiveTime.bind(this));
        eventEmitter.addListener(RaygunNativeBridge.ON_RESUME, this.rotateRUMSession.bind(this));
        eventEmitter.addListener(RaygunNativeBridge.ON_DESTROY, () => {
            eventEmitter.removeAllListeners(RaygunNativeBridge.ON_START);
            eventEmitter.removeAllListeners(RaygunNativeBridge.ON_PAUSE);
            eventEmitter.removeAllListeners(RaygunNativeBridge.ON_RESUME);
            eventEmitter.removeAllListeners(RaygunNativeBridge.ON_DESTROY);
        });

    };


    generateNetworkTimingEventCallbackMethod(name: string, sendTime: number, duration: number) {
        const data = {name, timing: {type: RUMEvents.NetworkCall, duration}};
        this.sendRUMEvent(RUMEvents.EventTiming, data, sendTime).catch();

    };


    markLastActiveTime = async () => {
        this.lastActiveAt = Date.now();
    };

    async rotateRUMSession(payload: Record<string, any>) {
        if (Date.now() - this.lastActiveAt > SessionRotateThreshold) {
            this.lastActiveAt = Date.now();
            await this.sendRUMEvent(RUMEvents.SessionEnd, {});
            this.curRUMSessionId = getDeviceBasedId();
            return this.sendRUMEvent(RUMEvents.SessionStart, {});
        }
    };


    async sendRUMEvent(eventName: string, data: Record<string, any>, timeAt?: number) {
        const timestamp = timeAt ? new Date(timeAt) : new Date();
        const rumMessage = {
            type: eventName,
            timestamp: timestamp.toISOString(),
            user: this.getCurrentUser(),
            sessionId: this.curRUMSessionId,
            version: this.version,
            os: Platform.OS,
            osVersion,
            platform,
            data: JSON.stringify([data])
        };

        return this.sendRUMPayload(rumMessage, this.apiKey, this.customRealUserMonitoringEndpoint);
    };


    sendCustomRUMEvent(
        getCurrentUser: () => User,
        apiKey: string,
        eventType: RUMEvents.ActivityLoaded | RUMEvents.NetworkCall,
        name: string,
        duration: number,
        customRealUserMonitoringEndpoint?: string
    ) {
        if (eventType === RUMEvents.ActivityLoaded) {
            this.reportStartupTime(name, duration);
            return;
        }
        if (eventType === RUMEvents.NetworkCall) {
            this.generateNetworkTimingEventCallbackMethod(name, Date.now() - duration, duration);
            return;
        }
        warn('Unknown RUM event type:', eventType);
    };


    async reportStartupTime(name: string, duration: number) {
        if (!this.curRUMSessionId) {
            this.curRUMSessionId = getDeviceBasedId();
            await this.sendRUMEvent(RUMEvents.SessionStart, {});
        }
        const data = {name, timing: {type: RUMEvents.ActivityLoaded, duration}};
        return this.sendRUMEvent(RUMEvents.EventTiming, data);
    };

//-------------------------------------------------------------------------------------------------
// SENDING RUM PAYLOADS
//-------------------------------------------------------------------------------------------------

    async sendRUMPayload(event: Record<string, any>, apiKey: string, customRealUserMonitoringEndpoint?: string) {
        return fetch(customRealUserMonitoringEndpoint || this.RAYGUN_RUM_ENDPOINT, {
            method: 'POST',
            headers: {'X-ApiKey': apiKey, 'Content-Type': 'application/json'},
            body: JSON.stringify({eventData: [event]})
        }).catch(err => {
            log(err);
        });
    };
}
