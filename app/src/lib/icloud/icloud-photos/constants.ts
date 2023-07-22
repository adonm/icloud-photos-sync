/**
 * File holding constant values for the iCloud class
 */

/**
 * Event lifecycle of iCloud-Photos class
 */
export enum EVENTS {
    SETUP_COMPLETE = `setup_complete`,
    READY = `ready`,
    ERROR = `error`
}

/**
 * To perform an operation, a record change tag is required. Hardcoding it for now
 */
export const RECORD_CHANGE_TAG = `21h2`;

/**
 * The max record limit, requested & returned by iCloud.
 * Should be 200, but in order to divide by 3 (for albums) and 2 (for all pictures) 198 is more convenient
 */
export const MAX_RECORDS_LIMIT = 198;