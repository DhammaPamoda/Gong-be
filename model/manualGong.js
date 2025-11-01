const Gong = require('./gong');
const { getLocalOffsetDetailsFromTimestamp } = require('../lib/utils/time');

const milSecInMin = 60000;

module.exports = class ManualGong {
  constructor(aTime, aGong = new Gong(), aIsActive = true) {
    this.time = aTime;
    this.isActive = aIsActive;
    this.gong = aGong;

    this.cloneWhileAddingTime = (courseStartTimeInMSec, courseStartDateUtcOffsetInMinutes) => {
      // Checking UTC offset to handle DST issues
      const futureGongTimeInMSec = this.time + courseStartTimeInMSec
      const futureGongTimeUtcOffset = getLocalOffsetDetailsFromTimestamp(futureGongTimeInMSec);
      const offsetDifference = futureGongTimeUtcOffset.rawMinutes - courseStartDateUtcOffsetInMinutes;
      const newManualGong = new ManualGong(
        futureGongTimeInMSec + (offsetDifference * milSecInMin),
        this.gong,
        this.isActive,
      );
      return newManualGong;
    };

    this.toggleActive = () => {
      this.isActive = !this.isActive;
    };
  }
};
