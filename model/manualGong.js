const moment = require('moment');
const Gong = require('./gong');

const milSecInMin = 60000;

module.exports = class ManualGong {
  constructor(aTime, aGong = new Gong(), aIsActive = true) {
    this.time = aTime;
    this.isActive = aIsActive;
    this.gong = aGong;

    this.cloneWhileAddingTime = (courseStartTimeInMSec, courseStartDateUtcOffsetInMinutes) => {
      // Agenda time encodes calendar days and a local clock time, not elapsed time.
      const daysOffset = Math.floor(this.time / (24 * 3600 * 1000));
      const msOffset = this.time % (24 * 3600 * 1000);
      const hours = Math.floor(msOffset / 3600000);
      const minutes = Math.floor((msOffset % 3600000) / 60000);
      const seconds = Math.floor((msOffset % 60000) / 1000);

      const gongTime = moment(courseStartTimeInMSec)
        .add(daysOffset, 'd')
        .hour(hours)
        .minute(minutes)
        .second(seconds)
        .millisecond(0)
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
