const moment = require('moment');

const EMERGENCY_ACTIVE = 1;
const EMERGENCY_END = 13;
const EMERGENCY_PREPARE = 14;

const supportedAlertCategories = [
    EMERGENCY_ACTIVE,
    EMERGENCY_END,
    EMERGENCY_PREPARE
];

const bufferTime = 3 * 60 * 1000; // 3 minutes in milliseconds

const newAlertTimeWithinBefferTime = (newAlertTime, currentAlertTime) => {
    const _newAlertTime = moment(newAlertTime).valueOf();
    const _currentAlertTime = moment(currentAlertTime).valueOf();
    return _newAlertTime - _currentAlertTime < bufferTime;
}

const canRunAlarmWithinBufferTime = (newAlertCategoryNumber, currentAlertCategoryNumber) => {
    if (newAlertCategoryNumber === currentAlertCategoryNumber) {
        return false;
    }
    if (currentAlertCategoryNumber === EMERGENCY_ACTIVE) {
        if (newAlertCategoryNumber === EMERGENCY_PREPARE) {
            return false;
        }
    }
    return true;
}

const runSecurityAlarm = (newAlertCategoryNumber, currentAlertCategoryNumber, newAlertTime, currentAlertTime) => {
    if (newAlertTimeWithinBefferTime(newAlertTime, currentAlertTime)
        && !canRunAlarmWithinBufferTime(newAlertCategoryNumber, currentAlertCategoryNumber)
    ) {
        return false;
    }
    return true;
}

module.exports = {
    EMERGENCY_ACTIVE,
    EMERGENCY_END,
    EMERGENCY_PREPARE,
    supportedAlertCategories,
    runSecurityAlarm
};