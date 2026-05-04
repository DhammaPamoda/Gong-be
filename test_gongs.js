require('@babel/register');
const gongsManager = require('./lib/gongsManager');
const scheduleManager = require('./lib/scheduleManager');
gongsManager.init();
setTimeout(() => {
  const nextJob = scheduleManager.getNextScheduledJob();
  if (nextJob) {
    console.log("Next job time:", nextJob.time);
    console.log("Next job string:", new Date(nextJob.time).toString());
  } else {
    console.log("No next job");
  }
  process.exit(0);
}, 1000);
