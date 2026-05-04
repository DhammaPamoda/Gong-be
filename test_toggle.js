require('@babel/register');
const gongsManager = require('./lib/gongsManager');
const scheduleManager = require('./lib/scheduleManager');
const moment = require('moment');

// Simulate the backend startup
gongsManager.init();

setTimeout(async () => {
  const keysBefore = scheduleManager.scheduledJobsMap.scheduledJobsMapKeysArray.map(t => new Date(t).toISOString());
  console.log("Keys before:", keysBefore);

  // Simulate toggle request for Day 8, 15:30
  const reqBody = {
    course_id: 1777150800000,
    dayNumber: 8,
    time: 55800000 // 15:30 in msec
  };

  try {
    await gongsManager.toggleGong(reqBody);
    console.log("Toggle success!");
  } catch(e) {
    console.error("Toggle failed:", e.message);
  }

  const keysAfter = scheduleManager.scheduledJobsMap.scheduledJobsMapKeysArray.map(t => new Date(t).toISOString());
  console.log("Keys after:", keysAfter);
  process.exit(0);
}, 2000);
