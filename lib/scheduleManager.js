/* eslint-disable operator-linebreak */
const moment = require('moment');
const scheduler = require('node-schedule');
const logger = require('../lib/logger');
const Job = require('../model/job');

let scheduleManagerInstance;

const errorOnPromisePlusLogger = (aErrMsg) => {
  const newError = new Error(aErrMsg);
  logger.scheduleManager.error(aErrMsg, { error: newError });
  return Promise.reject(newError);
};

const errorPlusLogger = (aErrMsg) => {
  const newError = new Error(aErrMsg);
  logger.scheduleManager.error(aErrMsg, { error: newError });
  return newError;
};

const loggerOutOfError = (aErrMsg, aError) => {
  logger.gongsManager.error(aErrMsg, { error: aError });
};

class ScheduledJob {
  /**
   *
   * @param {module.Job} aJob
   */
  constructor(aJob) {
    this.job = aJob;
    /** @var {Job} */
    this.schedulerJob = undefined;
  }
}

const scheduleAJob = (/* ScheduledJob */aScheduledJob) => {
  if (scheduleManagerInstance && scheduleManagerInstance.executerFunction) {
    const momentTime = moment(aScheduledJob.job.time);
    momentTime.startOf('minute');
    
    // Use RecurrenceRule to handle DST changes properly
    // This ensures that when DST changes, the job still fires at the correct local time
    // instead of being offset by 1 hour
    const rule = new scheduler.RecurrenceRule();
    rule.year = momentTime.year();
    rule.month = momentTime.month(); // 0-11 (January = 0)
    rule.date = momentTime.date();   // Day of month
    rule.hour = momentTime.hour();
    rule.minute = momentTime.minute();
    rule.second = 0;
    // Don't set rule.tz - use system's local timezone by default
    // This allows node-schedule to handle DST transitions automatically
    
    return scheduler.scheduleJob(rule,
      scheduleManagerInstance.executerFunction.bind(null, aScheduledJob.job));
  }
  throw new Error('ScheduleManager - no execution function was declared');
};

const dateFormat = 'YY-MM-DD HH:mm';
const dateTimeFormat = 'YYYY-MM-DD HH:mm:ss:SSS';

// eslint-disable-next-line no-unused-vars
const printJobMap = (aJobsMap) => {
  console.log('Map has ', aJobsMap.size, ' items :');
  aJobsMap.forEach((scheduledJob, time) => {
    console.log('date : ', moment(time)
      .format(dateFormat), '  ------>   gong : ', scheduledJob.job.data);
  });
};

const addTimeKeyToKeysArray = (aTimeKey, aTimeKeysArray) => {
  aTimeKeysArray.push(aTimeKey);
  aTimeKeysArray.sort((a, b) => a - b);
};

class ScheduledJobsMap {
  constructor() {
    this.scheduledJobsMap = new Map();
    this.scheduledJobsMapKeysArray = [];

    this.obsoleteJobsMap = new Map();
    this.doneJobsMapKeysArray = [];
    this.deletedJobsMapKeysArray = [];
    this.failedJobsMapKeysArray = [];
  }

  addScheduledJob(aNewScheduledJob) {
    if (this.scheduledJobsMapKeysArray.includes(aNewScheduledJob.job.time)) {
      throw new Error('ScheduledJobsMap.addScheduledJob  ERROR : there is already scheduled job',
        '\nnewRequestedJob = ', aNewScheduledJob.job,
        '\ncurrentScheduledJob = ', this.scheduledJobsMap.get(aNewScheduledJob.job.time));
    }
    this.scheduledJobsMap.set(aNewScheduledJob.job.time, aNewScheduledJob);
    addTimeKeyToKeysArray(aNewScheduledJob.job.time, this.scheduledJobsMapKeysArray);

    return true;
  }

  moveScheduledJobFromSchedule(aScheduledJob, aJobStatus = Job.statusEnum.DONE) {
    const scheduledJobTime = aScheduledJob.time;
    const foundScheduledJob = this.scheduledJobsMap.get(scheduledJobTime);
    if (foundScheduledJob) {
      this.scheduledJobsMap.delete(scheduledJobTime);
      foundScheduledJob.job.status = aJobStatus;
      this.obsoleteJobsMap.set(scheduledJobTime, foundScheduledJob);
      this.scheduledJobsMapKeysArray.splice(this.scheduledJobsMapKeysArray.indexOf(scheduledJobTime), 1);
      switch (aJobStatus) {
        case Job.statusEnum.DONE:
          addTimeKeyToKeysArray(scheduledJobTime, this.doneJobsMapKeysArray);
          break;
        case Job.statusEnum.DELETED:
          addTimeKeyToKeysArray(scheduledJobTime, this.deletedJobsMapKeysArray);
          break;
        case Job.statusEnum.FAILED:
          addTimeKeyToKeysArray(scheduledJobTime, this.failedJobsMapKeysArray);
          break;
        default:
          console.error('ScheduledJobsMap.moveScheduledJobFromSchedule  ERROR : couldn\'t ' +
            'find matching status handler for:', aJobStatus);
      }
    }
    return foundScheduledJob;
  }

  getNextScheduledJob() {
    let retScheduledJob = null;
    if (this.scheduledJobsMapKeysArray.length > 0) {
      retScheduledJob = this.scheduledJobsMap.get(this.scheduledJobsMapKeysArray[0]);
    }
    return retScheduledJob;
  }

  printState() {
    const retPrint = `ScheduledJobsMap state is :\n
    scheduledJobsMap - ${this.scheduledJobsMap.size} \n
    scheduledJobsMapKeysArray - ${this.scheduledJobsMapKeysArray.length} \n
    obsoleteJobsMap - ${this.obsoleteJobsMap.size} \n
    doneJobsMapKeysArray - ${this.doneJobsMapKeysArray.length} \n
    deletedJobsMapKeysArray - ${this.deletedJobsMapKeysArray.length} \n
    failedJobsMapKeysArray - ${this.failedJobsMapKeysArray.length} \n    `;
    return retPrint;
  }
}


const executorFunctionWrapper = aExecutorFunction =>
  /**
   *
   * @param {module.Job} aJob
   * @param {Date} aFireDate
   */(aJob, aFireDate) => {
    const errorPrefix = 'ScheduleManager::executorFunctionWrapper ERROR.';
    aExecutorFunction(aJob, aFireDate)
      .then(() => {
        scheduleManagerInstance.markJobAsDone(aJob);
        return true;
      })
      .catch((error) => {
        scheduleManagerInstance.markJobAsFailed(aJob);
        const errMsg = `${errorPrefix} Executer func failed with error`;
        loggerOutOfError(errMsg, error);
        return false;
      })
      .finally(() => {
        if (aJob.callBackFunc) {
          aJob.callBackFunc(aJob, aFireDate, aJob.status !== Job.statusEnum.FAILED);
        }
      });
  };

class ScheduleManager {
  constructor() {
    this.scheduledJobsMap = new ScheduledJobsMap();
    this.executerFunction = undefined;
    this.lastKnownTime = Date.now();
    this.timeCheckInterval = null;
  }

  start() {
    console.log('started ScheduleManager');
    // 🔹 Check for and cancel any missed jobs (computer was off)
    setTimeout(() => {
      this.cancelMissedJobs();
    }, 5000); // Wait 5 seconds for all jobs to be loaded
    // 🔹 Start monitoring for system time changes
    this.startTimeChangeMonitor();
  }

  /**
   * Cancel any jobs that were scheduled in the past (missed because computer was off)
   */
  cancelMissedJobs() {
    const now = moment();
    const jobsToCancel = [];
    
    this.scheduledJobsMap.scheduledJobsMap.forEach((scheduledJob, time) => {
      const scheduledTime = moment(time);
      
      // If job time has passed, it's a missed job
      if (scheduledTime.isBefore(now)) {
        jobsToCancel.push({ scheduledJob, time });
        logger.scheduleManager.info('Found missed job at startup', {
          jobTime: scheduledTime.format(dateTimeFormat),
          currentTime: now.format(dateTimeFormat),
          missedBy: now.diff(scheduledTime, 'minutes') + ' minutes'
        });
      }
    });
    
    // Cancel all missed jobs
    jobsToCancel.forEach(({ scheduledJob }) => {
      try {
        if (scheduledJob.schedulerJob) {
          scheduledJob.schedulerJob.cancel();
        }
        // Mark as failed since it was missed
        this.scheduledJobsMap.moveScheduledJobFromSchedule(scheduledJob.job, Job.statusEnum.FAILED);
      } catch (error) {
        logger.scheduleManager.error('Failed to cancel missed job', { error });
      }
    });
    
    if (jobsToCancel.length > 0) {
      console.log(`❌ Canceled ${jobsToCancel.length} missed job(s) at startup`);
    }
  }

  /**
   * Monitor for system clock changes and reschedule jobs if detected
   * Also checks for missed jobs that should have fired but didn't
   */
  startTimeChangeMonitor() {
    // Check every 30 seconds for time drift and missed jobs
    this.timeCheckInterval = setInterval(() => {
      const now = Date.now();
      const expectedTime = this.lastKnownTime + 30000; // Expected: last time + 30 seconds
      const timeDrift = Math.abs(now - expectedTime);
      
      // Check for jobs that should have fired but didn't (stuck jobs)
      this.checkAndCancelStuckJobs();
      
      // If drift > 5 minutes (300000 ms), system clock was likely changed
      // Use a higher threshold to avoid false positives from system lag
      if (timeDrift > 300000) {
        const driftMinutes = Math.round(timeDrift / 60000);
        console.log(`⚠️ System time change detected! Drift: ${driftMinutes} minutes`);
        logger.scheduleManager.warn('System time change detected', {
          drift: timeDrift,
          driftMinutes,
          lastKnownTime: new Date(this.lastKnownTime),
          currentTime: new Date(now)
        });
        
        // Reschedule all active jobs
        this.rescheduleAllJobs();
      }
      
      this.lastKnownTime = now;
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check for jobs that are in the past but still in the schedule (stuck jobs)
   * This happens when the system clock is changed and node-schedule doesn't fire the job
   */
  checkAndCancelStuckJobs() {
    const now = moment();
    const stuckJobs = [];
    
    this.scheduledJobsMap.scheduledJobsMap.forEach((scheduledJob, time) => {
      const scheduledTime = moment(time);
      
      // If a job is more than 1 minute in the past, it's stuck and should be canceled
      if (scheduledTime.isBefore(now.clone().subtract(1, 'minute'))) {
        stuckJobs.push({ scheduledJob, time, scheduledTime });
      }
    });
    
    // Cancel stuck jobs
    stuckJobs.forEach(({ scheduledJob, scheduledTime }) => {
      try {
        if (scheduledJob.schedulerJob) {
          scheduledJob.schedulerJob.cancel();
        }
        // Mark as failed since it was missed
        this.scheduledJobsMap.moveScheduledJobFromSchedule(scheduledJob.job, Job.statusEnum.FAILED);
        
        logger.scheduleManager.warn('Canceled stuck job', {
          jobTime: scheduledTime.format(dateTimeFormat),
          currentTime: now.format(dateTimeFormat),
          stuckFor: now.diff(scheduledTime, 'minutes') + ' minutes'
        });
      } catch (error) {
        logger.scheduleManager.error('Failed to cancel stuck job', { error });
      }
    });
    
    if (stuckJobs.length > 0) {
      console.log(`🧹 Cleaned up ${stuckJobs.length} stuck job(s)`);
    }
  }

  /**
   * Reschedule all active jobs after a time change
   * Also cancels any jobs that were missed (scheduled in the past)
   */
  rescheduleAllJobs() {
    logger.scheduleManager.info('Rescheduling all jobs due to time change');
    const now = moment();
    
    // Get all scheduled jobs
    const jobsToReschedule = [];
    const jobsToCancel = [];
    
    this.scheduledJobsMap.scheduledJobsMap.forEach((scheduledJob, time) => {
      const scheduledTime = moment(time);
      
      // Jobs in the past (missed because computer was off) - cancel them
      if (scheduledTime.isBefore(now)) {
        jobsToCancel.push({ scheduledJob, time });
        logger.scheduleManager.info('Canceling missed job', {
          jobTime: scheduledTime.format(dateTimeFormat),
          currentTime: now.format(dateTimeFormat),
          missedBy: now.diff(scheduledTime, 'minutes') + ' minutes'
        });
      }
      // Only reschedule jobs that are truly in the future (at least 2 minutes from now)
      // This prevents rescheduling jobs that are currently executing or about to execute
      else if (scheduledTime.isAfter(now.clone().add(2, 'minutes'))) {
        jobsToReschedule.push(scheduledJob);
      }
    });
    
    // Cancel missed jobs first
    jobsToCancel.forEach(({ scheduledJob, time }) => {
      try {
        if (scheduledJob.schedulerJob) {
          scheduledJob.schedulerJob.cancel();
        }
        // Mark as failed since it was missed
        this.scheduledJobsMap.moveScheduledJobFromSchedule(scheduledJob.job, Job.statusEnum.FAILED);
      } catch (error) {
        logger.scheduleManager.error('Failed to cancel missed job', { error });
      }
    });
    
    // Cancel and reschedule future jobs
    jobsToReschedule.forEach((scheduledJob) => {
      try {
        // Cancel the old scheduler job
        if (scheduledJob.schedulerJob) {
          scheduledJob.schedulerJob.cancel();
        }
        
        // Reschedule with the same job data
        scheduledJob.schedulerJob = scheduleAJob(scheduledJob);
        
        logger.scheduleManager.info('Job rescheduled', {
          jobTime: moment(scheduledJob.job.time).format(dateTimeFormat),
          jobData: scheduledJob.job.data
        });
      } catch (error) {
        logger.scheduleManager.error('Failed to reschedule job', {
          job: scheduledJob.job,
          error
        });
      }
    });
    
    if (jobsToCancel.length > 0) {
      console.log(`❌ Canceled ${jobsToCancel.length} missed job(s)`);
    }
    if (jobsToReschedule.length > 0) {
      console.log(`✅ Rescheduled ${jobsToReschedule.length} future job(s)`);
    }
  }

  setExecutor(aExecutorFunction) {
    this.executerFunction = executorFunctionWrapper(aExecutorFunction);
  }

  /**
   *
   * @param {module.Job} aJob4Removal
   */
  removeJob(aJob4Removal) {
    const errorPrefix = 'ScheduleManager.removeJob ERROR.';
    if (!aJob4Removal || !aJob4Removal.time || Number.isNaN(Number(aJob4Removal.time))) {
      const errMsg = `${errorPrefix} Job argument is [partly] empty or invalid`;
      throw errorPlusLogger(errMsg);
    }

    const removedScheduledJob =
      this.scheduledJobsMap.moveScheduledJobFromSchedule(aJob4Removal, Job.statusEnum.DELETED);
    if (removedScheduledJob && removedScheduledJob.schedulerJob) {
      removedScheduledJob.schedulerJob.cancel();
    } else {
      const errMsg = `${errorPrefix} Could not find job : ${JSON.stringify(aJob4Removal)}`;
      throw errorPlusLogger(errMsg);
    }
  }

  /**
   *
   * @param {module.Job} aJob
   */
  addJob(aJob) {
    const errorPrefix = 'ScheduleManager.addJob ERROR.';
    if (!aJob || !aJob.time || Number.isNaN(Number(aJob.time))) {
      const errMsg = `${errorPrefix} Job argument is [partly] empty or invalid`;
      throw errorPlusLogger(errMsg);
    }

    const newScheduledJob = new ScheduledJob(aJob);
    try {
      newScheduledJob.schedulerJob = scheduleAJob(newScheduledJob);
      if (!newScheduledJob.schedulerJob) {
        throw new Error('SchedulerJob returned null');
      }
      this.scheduledJobsMap.addScheduledJob(newScheduledJob);
    } catch (e) {
      if (newScheduledJob.schedulerJob) {
        newScheduledJob.schedulerJob.cancel();
      }
      const stringified = JSON.stringify(aJob);
      const errMsg = `${errorPrefix} Could not add a job : ${stringified}`;
      loggerOutOfError(errMsg, e);
      throw e;
    }
  }

  jobActionFunction(/* Job */aJobOrJobs, aAction = 'ADD') {
    const jobsArray = Array.isArray(aJobOrJobs) ? aJobOrJobs : Array.of(aJobOrJobs);
    if (jobsArray.length <= 0) {
      logger.scheduleManager.warn('ScheduleManager.jobActionFunction - no jobs received.', { action: aAction });
      return;
    }
    logger.scheduleManager.info('ScheduleManager.jobActionFunction',
      {
        init: (aAction === 'ADD_INIT'),
        action: aAction,
        jobs: jobsArray
      });
    jobsArray.forEach((job) => {
      try {
        switch (aAction) {
          case 'ADD':
          case 'ADD_INIT':
            this.addJob(job);
            break;
          case 'DELETE':
            this.removeJob(job);
            break;
          case 'UPDATE':
            break;
          default:
            console.error(`Not handeled Action = ${aAction}`);
            break;
        }
      } catch (e) {
        console.error(`Supposed to be handled before Error thrown. Action = ${aAction}`);
      }
    });
  }

  /**
   *
   * @param {module.Job[]} aJobsArray
   */
  addJobsArray(aJobsArray) {
    aJobsArray.forEach((job) => {
      this.addJob(job);
    });
    // printJobMap(this.jobsMap);
  }

  markJobAsDone(/* Job */aJob) {
    this.scheduledJobsMap.moveScheduledJobFromSchedule(aJob, Job.statusEnum.DONE);
  }

  markJobAsFailed(/* Job */aJob) {
    this.scheduledJobsMap.moveScheduledJobFromSchedule(aJob, Job.statusEnum.FAILED);
  }

  getNextScheduledJob() {
    const nextScheduledJob = this.scheduledJobsMap.getNextScheduledJob();
    return nextScheduledJob ? nextScheduledJob.job : null;
  }

  /**
   * Stop the time change monitor (cleanup on shutdown)
   */
  stop() {
    if (this.timeCheckInterval) {
      clearInterval(this.timeCheckInterval);
      this.timeCheckInterval = null;
      console.log('Stopped ScheduleManager time monitor');
    }
  }
}

scheduleManagerInstance = new ScheduleManager();
module.exports = scheduleManagerInstance;
