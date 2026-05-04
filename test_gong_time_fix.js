require('@babel/register');
const gongsManager = require('./lib/gongsManager');
const scheduleManager = require('./lib/scheduleManager');
const ExceptionGong = require('./model/exceptionGong');
const utilsManager = require('./lib/utilsManager');
const moment = require('moment');

gongsManager.init();

setTimeout(() => {
  const reqBody = {
    course_id: 1777150800000,
    day_number: 8,
    time: 55800000
  };
  const courseId = reqBody.course_id;
  const foundCourseSchedule = gongsManager.scheduledCoursesArray.find(c => c.id === courseId);
  
  const exception = ExceptionGong.fromJson(reqBody);
  const momentOfCourseStart = moment(foundCourseSchedule.date);
  const timeOfCourseStart = momentOfCourseStart.valueOf();
  const startDay = foundCourseSchedule.startFromDay || 0;
  
  const futureGongTimeInMSec = timeOfCourseStart + exception.getTotalTimeInMsec() - startDay * 24 * 3600000;
  
  const { rawMinutes: courseStartDateUtcOffsetInMinutes } = utilsManager.getLocalOffsetDetails(momentOfCourseStart._d);
  const futureGongTimeUtcOffset = new Date(futureGongTimeInMSec).getTimezoneOffset();
  const offsetDifference = futureGongTimeUtcOffset - courseStartDateUtcOffsetInMinutes;
  const gongTime = futureGongTimeInMSec + (offsetDifference * 60000);
  
  console.log("Calculated gongTime:", gongTime, new Date(gongTime).toISOString());
  console.log("In array?", gongsManager.automaticGongsMap.get(courseId).find(g => g.time === gongTime));
  process.exit(0);
}, 2000);
