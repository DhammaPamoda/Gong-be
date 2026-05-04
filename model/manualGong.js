const moment = require('moment');
const Gong = require('./gong');

const milSecInMin = 60000;

module.exports = class ManualGong {
  constructor(aTime, aGong = new Gong(), aIsActive = true) {
    this.time = aTime;
    this.isActive = aIsActive;
    this.gong = aGong;

    this.cloneWhileAddingTime = (courseStartTimeInMSec, courseStartDateUtcOffsetInMinutes) => {
      // Using moment to handle DST correctly by adding days as calendar days
      const daysOffset = Math.floor(this.time / (24 * 3600 * 1000));
      const msOffset = this.time % (24 * 3600 * 1000);
      
      const gongTime = moment(courseStartTimeInMSec)
        .add(daysOffset, 'd')
        .add(msOffset, 'ms')
        .valueOf();

      const newManualGong = new ManualGong(
        gongTime,
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
