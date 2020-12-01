import {cleanFilePath, filterOutReactFrames, log, noAddressAt, warn} from "../Utils";
import {StackFrame} from "react-native/Libraries/Core/Devtools/parseErrorStack";
import {sendCachedReports, sendCrashReport} from "../Transport";
import {generateCrashReportPayload} from "../RaygunClient";
import {BeforeSendHandler, RaygunClientOptions, Session} from "../Types";
import {NativeModules} from "react-native";
const { RaygunNativeBridge } = NativeModules;
const { osVersion, platform } = RaygunNativeBridge;

export default class CrashReporter {

    private enabled: boolean = false;
    private curSession: Session;
    private apiKey: string;
    private version: string;
    private enableCrashReporting: boolean;
    private disableNativeCrashReporting: boolean;
    private enableRealUserMonitoring: boolean;
    private disableNetworkMonitoring: boolean;
    private customCrashReportingEndpoint: string;
    private customRealUserMonitoringEndpoint: string;
    private onBeforeSendingCrashReport: BeforeSendHandler | null;
    private ignoredURLs: string[];

    constructor(curSession: Session, apiKey: string, disableNativeCrashReporting: boolean, customCrashReportingEndpoint: string, onBeforeSendingCrashReport: BeforeSendHandler | null) {

        //Setup error handler to divert errors to crash reporter
        const prevHandler = ErrorUtils.getGlobalHandler();
        ErrorUtils.setGlobalHandler(async (error: Error, isFatal?: boolean) => {
            await this.processUnhandledError(error, curSession, apiKey, disableNativeCrashReporting, customCrashReportingEndpoint, onBeforeSendingCrashReport, isFatal);
            prevHandler && prevHandler(error, isFatal);
        });

        //Set up rejection handler to divert rejections to crash reporter
        const rejectionTracking = require('promise/setimmediate/rejection-tracking');
        rejectionTracking.disable();
        rejectionTracking.enable({
            allRejections: true,
            onUnhandled: this.processUnhandledRejection
        });
        if (disableNativeCrashReporting) {
            setTimeout(() => sendCachedReports(apiKey, customCrashReportingEndpoint), 10);
        }

        // Assign the values parsed in (assuming initiation is the only time these are altered).
        this.curSession = curSession;
        this.apiKey = apiKey;
        this.disableNativeCrashReporting = disableNativeCrashReporting;
        this.customCrashReportingEndpoint = customCrashReportingEndpoint;
        this.onBeforeSendingCrashReport = onBeforeSendingCrashReport;
    }



    processUnhandledRejection (error: any, curSession: Session, apiKey: string, enableNativeCrashReporting: boolean, customCrashReportingEndpoint: string, onBeforeSendingCrashReport: BeforeSendHandler) {
        this.processUnhandledError(error, curSession, apiKey, enableNativeCrashReporting, customCrashReportingEndpoint, onBeforeSendingCrashReport, false);
    };

    async processUnhandledError (error: Error, curSession: Session, apiKey: string, enableNativeCrashReporting: boolean, customCrashReportingEndpoint: string, onBeforeSendingCrashReport: BeforeSendHandler, isFatal?: boolean ) {
        if (!error || !error.stack) {
            warn('Unrecognized error occurred');
            return;
        }

        const parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack');
        const symbolicateStackTrace = require('react-native/Libraries/Core/Devtools/symbolicateStackTrace');
        const stackFrames = parseErrorStack(error);
        const cleanedStackFrames: StackFrame[] = __DEV__
            ? await symbolicateStackTrace(stackFrames)
            : { stack: cleanFilePath(stackFrames) };

        const stack = cleanedStackFrames || [].filter(filterOutReactFrames).map(noAddressAt);

        if (isFatal) {
            curSession.tags.add('Fatal');
        }

        const payload = await generateCrashReportPayload(error, stack, curSession);

        const modifiedPayload =
            onBeforeSendingCrashReport && typeof onBeforeSendingCrashReport === 'function' ? onBeforeSendingCrashReport(Object.freeze(payload)) : payload;

        if (!modifiedPayload) {
            return;
        }

        if (enableNativeCrashReporting) {
            log('Send crash report via Native');
            RaygunNativeBridge.sendCrashReport(JSON.stringify(modifiedPayload), apiKey);
            return;
        }

        log('Send crash report via JS');
        sendCrashReport(modifiedPayload, apiKey, customCrashReportingEndpoint);
    }
};
