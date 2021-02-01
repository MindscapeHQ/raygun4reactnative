import {ConsoleLogLevel, LogLevel} from "./Types";

export default class RaygunLogger {

    //#region -- Init --------------------------------------------------------------------------------------------------
    private static initialized: boolean = false;
    private static logLevelArr: any[] = [];
    private static logLevel: number = -1;
    private static unablePrints: number = 0;

    public static init(level: LogLevel) {
        this.logLevelArr = Object.values(LogLevel);
        this.logLevel = this.logLevelArr.indexOf(level);
        this.initialized = true;
    }

    //#endregion--------------------------------------------------------------------------------------------------------

    //#region -- Log Methods -------------------------------------------------------------------------------------------

    /**
     * Verbose logging. This log is used to print out object details.
     * Note: Console.verbose does not exist. Rather, this log level has a mandatory addition information as it should be
     * used to print out objects.
     * @param msg - The reason for logging
     * @param additionInfo - Some object related to the log.
     */
    public static v(msg: string, additionInfo: any) {
        if (!this.validLogLevel(LogLevel.verbose)) {
            this.unable();
            return;
        }
        this.emitLog(ConsoleLogLevel.debug, additionInfo)
    }

    /**
     * Debug logging. This will print information about what is happening, the good, the bad, everything.
     * @param msg - The reason for logging
     * @param additionInfo - Some object related to the log.
     */
    public static d(msg: string, additionInfo?: any) {
        if (!this.validLogLevel(LogLevel.debug)) {
            this.unable();
            return;
        }
        this.emitLog(ConsoleLogLevel.debug, additionInfo)
    }

    /**
     * Info logging. This will print information about steps being taken, but nothing more.
     * @param msg - The reason for logging
     * @param additionInfo - Some object related to the log.
     */
    public static i(msg: string, additionInfo?: any) {
        if (!this.validLogLevel(LogLevel.info)) {
            this.unable();
            return;
        }
        this.emitLog(ConsoleLogLevel.info, additionInfo)
    }

    /**
     * Warn logging. This will print warnings.
     * @param msg - The reason for logging
     * @param additionInfo - Some object related to the log.
     */
    public static w(msg: string, additionInfo?: any) {
        if (!this.validLogLevel(LogLevel.warn)) {
            this.unable();
            return;
        }
        this.emitLog(ConsoleLogLevel.warn, additionInfo)
    }

    /**
     * Error logging. This will print errors.
     * @param msg - The reason for logging
     * @param additionInfo - Some object related to the log.
     */
    public static e(msg: string, additionInfo?: any) {
        if (!this.validLogLevel(LogLevel.error)) {
            this.unable();
            return;
        }
        this.emitLog(ConsoleLogLevel.error, additionInfo)
    }

    //#endregion ------------------------------------------------------------------------------------------------------

    //#region -- Helper Methods ----------------------------------------------------------------------------------------
    /**
     * This warning will print only if the RaygunClient has not been initialize (as that is where the RaygunLogger is
     * also initialized).
     * @param action - The action attempted before initializing the RaygunClient.
     */
    private static unable() {
        if (!this.initialized && this.logLevel > 0 && this.unablePrints === 0) {
            console.warn("Unable to commit some action as the RaygunClient has not been initialized");
            console.info("To initialize the RaygunClient, see documentation for the 'init(...)' method");
            console.info("Try running the client with log level 'verbose' or 'debug' to aid in solving this issue");

            this.unablePrints = 1;
        }
    }

    /**
     * Check if the log level is valid with the current configurations. If the RaygunClient hasn't been initialized,
     * then the logger hasn't been initialized either.
     * @param level
     * @private
     */
    private static validLogLevel(level: LogLevel): boolean {
        return this.initialized ? this.logLevelArr.indexOf(level) <= this.logLevel : false;
    }

    /**
     * Print the log.
     * @param level - ConsoleLogLevel of the event
     * @param msg - Message of the event
     * @param additionInfo - Any additional objects to be printed.
     * @private
     */
    private static emitLog(level: ConsoleLogLevel, msg: string, additionInfo?: any) {
        if (additionInfo)
            console[level](msg, additionInfo);
        else
            console[level](msg);
    }

    //#endregion -------------------------------------------------------------------------------------------------------

}