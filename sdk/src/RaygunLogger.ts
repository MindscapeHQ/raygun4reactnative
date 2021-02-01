import {LogLevel} from "./Types";

export default class RaygunLogger {

    //#region -- Init --------------------------------------------------------------------------------------------------
    private static logLevelArr: any[] = [];
    private static logLevel: number = -2;

    private static consoles: any[] = [console.error, console.warn, console.info, console.debug];

    public static init(level: LogLevel) {
        this.logLevelArr = Object.values(LogLevel);
        this.logLevel = this.logLevelArr.indexOf(level);
        if (level === LogLevel.off) this.logLevel = -1;
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
        this.emitLog(LogLevel.verbose, msg, additionInfo)
    }

    /**
     * Debug logging. This will print information about what is happening, the good, the bad, everything.
     * @param msg - The reason for logging
     * @param additionInfo - Some object related to the log.
     */
    public static d(msg: string, additionInfo?: any) {
        this.emitLog(LogLevel.debug, msg, additionInfo)
    }

    /**
     * Info logging. This will print information about steps being taken, but nothing more.
     * @param msg - The reason for logging
     * @param additionInfo - Some object related to the log.
     */
    public static i(msg: string, additionInfo?: any) {
        this.emitLog(LogLevel.info, msg, additionInfo)
    }

    /**
     * Warn logging. This will print warnings.
     * @param msg - The reason for logging
     * @param additionInfo - Some object related to the log.
     */
    public static w(msg: string, additionInfo?: any) {
        this.emitLog(LogLevel.warn, msg, additionInfo)
    }

    /**
     * Error logging. This will print errors.
     * @param msg - The reason for logging
     * @param additionInfo - Some object related to the log.
     */
    public static e(msg: string, additionInfo?: any) {
        this.emitLog(LogLevel.error, msg, additionInfo)
    }

    //#endregion ------------------------------------------------------------------------------------------------------

    //#region -- Helper Methods ----------------------------------------------------------------------------------------

    /**
     * Print the log.
     * @param level - ConsoleLogLevel of the event
     * @param msg - Message of the event
     * @param additionInfo - Any additional objects to be printed.
     * @private
     */
    private static emitLog(level: LogLevel, msg: string, additionInfo?: any) {
        // If some action is attempted before the client has been initialized, inform the user of the first case.
        if (this.logLevel === -2){
            this.consoles[1](`Action attempted on the RaygunClient before initialization: ${msg}`)
            this.logLevel = -1;
        }

        const levelIndex = this.logLevelArr.indexOf(level);
        /*
        If the current level is not less than or equal to the level set at the start, ignore.
        e.g. start = warn (2), level = debug (3). 2 - 3 = -1
        e.g. start = warn (2), level = warn (2). 2 - 2 = 0

        'off' will always be -1, so subtracting any index from off will return a negative (as indexs are
        */
        if (levelIndex === -1 || (this.logLevel - levelIndex) < 0) return;

        /*
        If this is a valid log level, then match it with the console command array.
        The consoles array doesn't have 'off' so it's indexing has a negative one difference compared to the
        logLevelArr length (levelIndex - 1).

        The consoles array doesn't have a 'verbose' and will use debug instead. If the level index is verbose (5)
        or debug (4) then they will be set to the length - 1 (3).
        */
        const consoleIndex = levelIndex >= this.consoles.length ? this.consoles.length - 1 : levelIndex - 1;

        /*
        This method of extracting the console loggers removes the stack trace that is printed by default, and allows
        the loggers to simply log exactly what is parsed through
         */
        if (additionInfo)
            this.consoles[consoleIndex](msg + "\n", JSON.stringify(additionInfo));
        else
            this.consoles[consoleIndex](msg);
    }

    //#endregion -------------------------------------------------------------------------------------------------------

}