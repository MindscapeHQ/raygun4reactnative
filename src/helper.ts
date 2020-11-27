/**
 * Ensure a given report data payload uses uppercase keys
 * @param obj A report data payload or an array of report data payloads
 */
export const upperFirst = (obj: any | any[]): any | any[] => {
    if (Array.isArray(obj)) {
        return obj.map(upperFirst);
    }
    if (typeof obj === 'object') {
        return Object.entries(obj).reduce(
            (all, [key, val]) => ({
                ...all,
                ...(key !== 'customData'
                    ? { [key.slice(0, 1).toUpperCase() + key.slice(1)]: upperFirst(val) }
                    : { CustomData: val })
            }),
            {}
        );
    }
    return obj;
};

/**
 * Deep clone an object
 * @param object
 */
export const clone = <T>(object: T): T => JSON.parse(JSON.stringify(object));
