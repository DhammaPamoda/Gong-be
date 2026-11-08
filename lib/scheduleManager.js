/* eslint-disable operator-linebreak */
const moment = require('moment');
const scheduler = require('node-schedule');
const logger = require('./logger');
const Job = require('../model/job');
const relaysModule = require('../relay');

let scheduleManagerInstance;

// Map to track health check jobs by gong time (so we can cancel them when gong is canceled)
const healthCheckJobsMap = new Map();

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

/**
 * Schedule a pre-gong health check 1 minute before a scheduled gong
 * This ensures the relay device is connected before the gong fires
 * @param {number} gongTime - The time of the gong (epoch ms)
 */
const scheduleHealthCheck = (gongTime) => {
  const healthCheckTime = moment(gongTime).subtract(1, 'minute');

  // Only schedule if health check time is in the future
  if (healthCheckTime.isAfter(moment())) {
    const healthCheckRule = new scheduler.RecurrenceRule();
    healthCheckRule.year = healthCheckTime.year();
    healthCheckRule.month = healthCheckTime.month();
    healthCheckRule.date = healthCheckTime.date();
    healthCheckRule.hour = healthCheckTime.hour();
    healthCheckRule.minute = healthCheckTime.minute();
    healthCheckRule.second = 0;

    const healthCheckJob = scheduler.scheduleJob(healthCheckRule, async () => {
      logger.scheduleManager.info('Running pre-gong device health check', {
        gongTime: moment(gongTime).format(dateTimeFormat),
        checkTime: moment().format(dateTimeFormat),
      });

      try {
        const healthResult = await relaysModule.checkDeviceHealth();
        if (healthResult.connected) {
          if (healthResult.recovered) {
            logger.scheduleManager.info('Pre-gong health check: Device recovered successfully');
          } else {
            logger.scheduleManager.info('Pre-gong health check: Device is healthy');
          }
        } else {
          logger.scheduleManager.warn('Pre-gong health check: Device not connected!', {
            error: healthResult.error,
            gongTime: moment(gongTime).format(dateTimeFormat),
          });
        }
      } catch (error) {
        logger.scheduleManager.error('Pre-gong health check failed', { error });
      }

      // Remove from tracking map after execution
      healthCheckJobsMap.delete(gongTime);
    });

    // Track health check job so we can cancel it if gong is canceled
    healthCheckJobsMap.set(gongTime, healthCheckJob);
  }
};

/**
 * Cancel a health check job when its associated gong is canceled
 * @param {number} gongTime - The time of the gong (epoch ms)
 */
const cancelHealthCheck = (gongTime) => {
  const healthCheckJob = healthCheckJobsMap.get(gongTime);
  if (healthCheckJob) {
    healthCheckJob.cancel();
    healthCheckJobsMap.delete(gongTime);
    logger.scheduleManager.info('Canceled pre-gong health check', {
      gongTime: moment(gongTime).format(dateTimeFormat),
    });
  }
};

const scheduleAJob = (/* ScheduledJob */aScheduledJob) => {
  if (scheduleManagerInstance && scheduleManagerInstance.executerFunction) {
    const momentTime = moment(aScheduledJob.job.time);
    momentTime.startOf('minute');

    // Schedule a health check 1 minute before the gong
    scheduleHealthCheck(aScheduledJob.job.time);

    // Use RecurrenceRule to handle DST changes properly
    // This ensures that when DST changes, the job still fires at the correct local time
    // instead of being offset by 1 hour
    const rule = new scheduler.RecurrenceRule();
    rule.year = momentTime.year();
    rule.month = momentTime.month(); // 0-11 (January = 0)
    rule.date = momentTime.date(); // Day of month
    rule.hour = momentTime.hour();
    rule.minute = momentTime.minute();
    rule.second = 0;
    // Don't set rule.tz - use system's local timezone by default
    // This allows node-schedule to handle DST transitions automatically

    return scheduler.scheduleJob(
      rule,
      scheduleManagerInstance.executerFunction.bind(null, aScheduledJob.job),
    );
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
      throw new Error(
        'ScheduledJobsMap.addScheduledJob  ERROR : there is already scheduled job',
        '\nnewRequestedJob = ',
        aNewScheduledJob.job,
        '\ncurrentScheduledJob = ',
        this.scheduledJobsMap.get(aNewScheduledJob.job.time),
      );
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
  }

  start() {
    console.log('started ScheduleManager');
    // 🔹 Check for and cancel any missed jobs (computer was off)
    setTimeout(() => {
      this.cancelMissedJobs();
    }, 5000); // Wait 5 seconds for all jobs to be loaded
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
          missedBy: `${now.diff(scheduledTime, 'minutes')} minutes`,
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
      // Also cancel the associated pre-gong health check
      cancelHealthCheck(aJob4Removal.time);
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
    logger.scheduleManager.info(
      'ScheduleManager.jobActionFunction',
      {
        init: (aAction === 'ADD_INIT'),
        action: aAction,
        jobs: jobsArray,
      },
    );
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
    // Cancel health check if it hasn't run yet (unlikely since job just completed)
    cancelHealthCheck(aJob.time);
  }

  markJobAsFailed(/* Job */aJob) {
    this.scheduledJobsMap.moveScheduledJobFromSchedule(aJob, Job.statusEnum.FAILED);
    // Cancel health check if it hasn't run yet
    cancelHealthCheck(aJob.time);
  }

  getNextScheduledJob() {
    const nextScheduledJob = this.scheduledJobsMap.getNextScheduledJob();
    return nextScheduledJob ? nextScheduledJob.job : null;
  }
}

scheduleManagerInstance = new ScheduleManager();
module.exports = scheduleManagerInstance;
