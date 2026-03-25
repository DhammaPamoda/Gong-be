const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const players = [
  'mplayer',
  'afplay',
  'ffplay',
  'mpg123',
  'mpg321',
  'play',
  'omxplayer',
  'aplay',
  'cmdmp3',
];
const player = require('play-sound')({ players });

const logger = require('./logger');
const RunPromiseRoutineInQueue = require('./utils/runPromiseRoutineInQueue');
const utilsManager = require('./utilsManager');
const relaysModule = require('../relay');

// FTDI status log for tracking relay accessibility
const FTDI_LOG_DIR = path.join(os.homedir(), '.local/share/gong/logs');
const FTDI_LOG_FILE = path.join(FTDI_LOG_DIR, 'ftdi_status.log');

// Audio playback timeout in milliseconds (3 minutes - allows for long gong files with repeats)
const AUDIO_PLAYBACK_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Log FTDI/relay status to dedicated log file
 * @param {string} status - Status code (e.g., RELAY_OK, RELAY_FAILED)
 * @param {string} details - Additional details
 */
const logFtdiStatus = (status, details) => {
  try {
    if (!fs.existsSync(FTDI_LOG_DIR)) {
      fs.mkdirSync(FTDI_LOG_DIR, { recursive: true });
    }
    // Use local time (same as shell script's `date "+%Y-%m-%d %H:%M:%S"`)
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const logLine = `${timestamp} | ${status} | ${details}\n`;
    fs.appendFileSync(FTDI_LOG_FILE, logLine);
  } catch (err) {
    // Silently fail - don't break gong playback due to logging issues
    console.error('Failed to write FTDI status log:', err.message);
  }
};

const soundPath = path.resolve(__dirname, '../assets/sounds');

const isOverrideProduction = false;
const isProduction = process.env.NODE_ENV === 'production' || isOverrideProduction;

/**
 * Kill an audio process and all its children safely
 * @param {number} pid - Process ID to kill
 */
const killAudioProcess = (pid) => {
  if (!pid) return;

  try {
    // First try SIGTERM for graceful shutdown
    process.kill(pid, 'SIGTERM');

    // Schedule SIGKILL as a backup after 500ms
    setTimeout(() => {
      try {
        process.kill(pid, 'SIGKILL');
      } catch (e) {
        // Process already dead, ignore
      }
    }, 500);
  } catch (e) {
    // Process already dead or permission denied, ignore
  }
};

/**
 * Clean up any zombie child processes
 * @param {RelayAndSoundManager} relayAndSoundManagerInstance
 */
const cleanupZombieProcesses = (relayAndSoundManagerInstance) => {
  relayAndSoundManagerInstance.currentAudioProcess = null;
  relayAndSoundManagerInstance.currentAudioPid = null;
  relayAndSoundManagerInstance.currentTimeoutId = null;
  relayAndSoundManagerInstance.currentAudioStartTime = null;
  relayAndSoundManagerInstance.currentAudioFile = null;
};

/**
 * Get process state from /proc filesystem (Linux only)
 * @param {number} pid - Process ID
 * @returns {object} Process state info or null if not available
 */
const getProcessState = (pid) => {
  if (!pid || process.platform !== 'linux') return null;

  try {
    const statPath = `/proc/${pid}/stat`;
    if (!fs.existsSync(statPath)) {
      return { state: 'DEAD', message: 'Process does not exist' };
    }

    const stat = fs.readFileSync(statPath, 'utf8');
    const parts = stat.split(' ');
    const state = parts[2]; // State is the 3rd field

    const stateMap = {
      R: 'RUNNING',
      S: 'SLEEPING',
      D: 'DISK_SLEEP',
      Z: 'ZOMBIE',
      T: 'STOPPED',
      X: 'DEAD',
    };

    return {
      state: stateMap[state] || state,
      rawState: state,
      ppid: parts[3],
      utime: parts[13],
      stime: parts[14],
    };
  } catch (e) {
    return { state: 'UNKNOWN', error: e.message };
  }
};

/**
 *
 * @param {module.Gong} aGongToPlay
 * @param {RelayAndSoundManager} relayAndSoundManagerInstance
 * @return {Promise<any>}
 */
const playSoundGong = (aGongToPlay, relayAndSoundManagerInstance) => {
  let { volume, repeat } = aGongToPlay;
  volume = (Number.isNaN(Number(volume)) || volume < 1 || volume > 100) ? 100 : volume;
  repeat = (Number.isNaN(Number(repeat)) || repeat < 1 || repeat > 20) ? 1 : repeat;

  // NOTE: We explicitly do NOT use shell: true to avoid zombie shell processes
  // The mplayer arguments need to be passed as an array, not as a single string
  const options = {
    mplayer: ['-ao', 'pulse', '-volume', String(volume), '-loop', String(repeat)],
    ffplay: ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-af', `volume=${volume / 100}`, '-loop', String(repeat), '-noborder'],
    mpg123: ['--loop', String(repeat), '--scale', String(volume * 327.67)], // mpg123 scale is 0-32767
    aplay: [], // aplay doesn't support volume/loop the same way
    cwd: soundPath,
    // stdio: 'ignore' is set by play-sound
  };

  let { gongType } = aGongToPlay;
  gongType = Number.isNaN(Number(gongType)) ? 0 : gongType;
  const whatGongType = utilsManager.gongsMap.get(gongType) || utilsManager.gongsMap.get(0);

  return new Promise((resolve, reject) => {
    let isSettled = false; // Track if promise has been settled
    let timeoutId = null;

    /**
     * Settle the promise (only once) and cleanup
     */
    const settlePromise = (error, result) => {
      if (isSettled) return; // Already settled
      isSettled = true;

      // Clear timeout if set
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Cleanup instance state
      cleanupZombieProcesses(relayAndSoundManagerInstance);

      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    };

    // Set up timeout to prevent indefinite blocking
    timeoutId = setTimeout(() => {
      if (isSettled) return;

      const pid = relayAndSoundManagerInstance.currentAudioPid;
      const startTime = relayAndSoundManagerInstance.currentAudioStartTime;
      const audioFile = relayAndSoundManagerInstance.currentAudioFile;
      const elapsedMs = startTime ? Date.now() - startTime : 'unknown';
      const processState = getProcessState(pid);

      console.error('⏰ Audio playback timeout! Killing process...');
      console.error(`⏰ Diagnostic info: PID=${pid}, elapsed=${elapsedMs}ms, file=${audioFile}`);
      console.error('⏰ Process state:', processState);

      logger.relayAndSoundManager.error('Audio playback timeout - DIAGNOSTIC', {
        gong: aGongToPlay,
        timeoutMs: AUDIO_PLAYBACK_TIMEOUT_MS,
        pid,
        audioFile,
        elapsedMs,
        processState,
        callbackReceived: false,
        isSettled,
        timestamp: new Date().toISOString(),
      });

      // Kill the audio process
      if (pid) {
        killAudioProcess(pid);
      }
      if (relayAndSoundManagerInstance.currentAudioProcess) {
        try {
          relayAndSoundManagerInstance.currentAudioProcess.kill('SIGKILL');
        } catch (e) {
          console.error('🔊 Failed to kill audio process:', e.message);
        }
      }

      // Resolve with timeout error (don't reject to avoid blocking the queue)
      settlePromise(null, { timedOut: true, message: 'Audio playback timed out', pid, elapsedMs, processState });
    }, AUDIO_PLAYBACK_TIMEOUT_MS);

    relayAndSoundManagerInstance.currentTimeoutId = timeoutId;

    // Start the audio process
    const audioStartTime = Date.now();
    const audioFile = whatGongType.pathName;
    let audioProcess;
    let callbackCalled = false;

    try {
      audioProcess = player.play(audioFile, options, (err) => {
        // Callback when audio process exits
        callbackCalled = true;
        const elapsedMs = Date.now() - audioStartTime;

        if (err && !err.killed && !isSettled) {
          console.error(`🔊 Audio process callback error after ${elapsedMs}ms:`, err.message || err);
          logger.relayAndSoundManager.error('Audio process callback error', {
            gong: aGongToPlay,
            audioFile,
            elapsedMs,
            error: err.message || String(err),
            pid: relayAndSoundManagerInstance.currentAudioPid,
          });
          settlePromise(err);
        } else if (!isSettled) {
          console.log(`🔊 Audio playback completed successfully after ${elapsedMs}ms`);
          settlePromise(null, true);
        }
      });
    } catch (spawnError) {
      console.error('🔊 Failed to spawn audio process:', spawnError.message);
      logger.relayAndSoundManager.error('Failed to spawn audio process', {
        gong: aGongToPlay,
        audioFile,
        error: spawnError.message,
      });
      settlePromise(spawnError);
      return;
    }

    if (!audioProcess) {
      logger.relayAndSoundManager.error('Audio player returned null process', { gong: aGongToPlay, audioFile });
      settlePromise(new Error('Failed to start audio player - no process returned'));
      return;
    }

    // Store the current audio process and metadata for potential cancellation and diagnostics
    relayAndSoundManagerInstance.currentAudioProcess = audioProcess;
    relayAndSoundManagerInstance.currentAudioStartTime = audioStartTime;
    relayAndSoundManagerInstance.currentAudioFile = audioFile;

    // Also store the PID for direct killing
    if (audioProcess.pid) {
      relayAndSoundManagerInstance.currentAudioPid = audioProcess.pid;
      console.log(`🎵 Started audio process: PID=${audioProcess.pid}, file=${audioFile}, gongType=${gongType}, volume=${volume}, repeat=${repeat}`);
      logger.relayAndSoundManager.info('Audio process started', {
        pid: audioProcess.pid,
        audioFile,
        gong: aGongToPlay,
        timeoutMs: AUDIO_PLAYBACK_TIMEOUT_MS,
      });
    }

    // Add error handler for the spawned process
    audioProcess.on('error', (err) => {
      const elapsedMs = Date.now() - audioStartTime;
      console.error(`🔊 Audio process spawn error after ${elapsedMs}ms:`, err.message);
      logger.relayAndSoundManager.error('Audio process spawn error event', {
        gong: aGongToPlay,
        audioFile,
        elapsedMs,
        error: err.message,
        pid: audioProcess.pid,
        callbackCalled,
      });
      settlePromise(err);
    });

    // Add exit handler as a backup (in case the callback isn't called)
    audioProcess.on('exit', (code, signal) => {
      const elapsedMs = Date.now() - audioStartTime;

      if (!isSettled) {
        console.log(`🔊 Audio process exited: code=${code}, signal=${signal}, elapsed=${elapsedMs}ms, callbackCalled=${callbackCalled}`);

        // Log if callback wasn't called (this is the problematic case)
        if (!callbackCalled) {
          logger.relayAndSoundManager.warn('Audio process exit without callback - potential issue', {
            gong: aGongToPlay,
            audioFile,
            elapsedMs,
            exitCode: code,
            signal,
            pid: audioProcess.pid,
            callbackCalled,
          });
        }

        if (code === 0 || signal === 'SIGTERM' || signal === 'SIGKILL') {
          settlePromise(null, true);
        } else {
          settlePromise(new Error(`Audio process exited with code ${code}`));
        }
      } else {
        // Already settled but exit event fired - log for diagnostics
        console.log(`🔊 Audio process exit event (already settled): code=${code}, signal=${signal}, elapsed=${elapsedMs}ms`);
      }
    });
  });
};

/**
 * @param {module.Gong} aGongToPlay
 * @param {boolean} aIsToOpen
 */
const turnRelayPortsOn = (aGongToPlay) => relaysModule.turnRelayPortsOn(aGongToPlay.areas);

const turnRelayPortsOff = () => relaysModule.setRelayPortsAll(false);

const activateRelay = async (aFunc, ...aParams) => {
  try {
    await aFunc.call(null, ...aParams);
    return true;
  } catch (e) {
    // if (isProduction) {
    if (false) { // Decided to keep on and play gong even if relay failed
      throw e;
    } else {
      return false;
    }
  }
};

/**
 *
 * @param {module.Gong} aGongToPlay
 * @param {RelayAndSoundManager} relayAndSoundManagerInstance
 */
const orchestrateGong = async (aGongToPlay, relayAndSoundManagerInstance) => {
  try {
    let relayResult = await activateRelay(turnRelayPortsOn, aGongToPlay);
    if (!relayResult) {
      logFtdiStatus('RELAY_FAILED', `Failed to turn ON relay ports: ${JSON.stringify(aGongToPlay.areas)}`);
    }
    await playSoundGong(aGongToPlay, relayAndSoundManagerInstance);
    if (relayResult) {
      relayResult = await activateRelay(turnRelayPortsOff);
      if (!relayResult) {
        logFtdiStatus('RELAY_FAILED', 'Failed to turn OFF relay ports after gong');
      }
    }
    if (!relayResult) {
      logFtdiStatus('RELAY_INACCESSIBLE', `Gong played without relay - gongType: ${aGongToPlay.gongType}, areas: ${JSON.stringify(aGongToPlay.areas)}`);
      throw new Error('Relay was un-accessible. Gong is played even though...');
    }
    logFtdiStatus('RELAY_OK', `Gong played successfully - gongType: ${aGongToPlay.gongType}, areas: ${JSON.stringify(aGongToPlay.areas)}`);
    return true;
  } catch (error) {
    logger.relayAndSoundManager.error(
      'RelayAndSoundManager::orchestrateGong ERROR',
      {
        gong: aGongToPlay,
        error,
      },
    );
    throw (error);
  }
};

class RelayAndSoundManager {
  constructor() {
    this.currentAudioProcess = null;
    this.currentAudioPid = null;
    this.currentTimeoutId = null;
    this.currentAudioStartTime = null;
    this.currentAudioFile = null;
    this.runPromisesInQueue = new RunPromiseRoutineInQueue((aPayload) => orchestrateGong(aPayload, this));
  }

  /**
   *
   * @param {module.Job} aGongToPlayJob
   * @param {Date} aFireDate
   */
  playGongForJob = (aGongToPlayJob, aFireDate) => this.runPromisesInQueue.run(aGongToPlayJob.data)
    .then(() => {
      logger.relayAndSoundManager.info(
        'RelayAndSoundManager.playGongForJob ',
        {
          job: aGongToPlayJob,
          execTime: aFireDate,
        },
      );
    })
    .catch((error) => {
      logger.relayAndSoundManager.error(
        'RelayAndSoundManager.playGongForJob ERROR',
        {
          job: aGongToPlayJob,
          error,
        },
      );
    });

  /**
   *
   * @param {module.Gong} aGongToPlay
   */
  playImmediateGong = (aGongToPlay) => this.runPromisesInQueue.run(aGongToPlay)
    .then((aaa) => {
      console.log('----------------', aaa);
      logger.relayAndSoundManager.info('RelayAndSoundManager.playImmediateGong ', { gong: aGongToPlay });
    })
    .catch((error) => {
      logger.relayAndSoundManager.error(
        'RelayAndSoundManager.playImmediateGong ERROR',
        {
          gong: aGongToPlay,
          error,
        },
      );
    });

  /**
   * Cancel the currently playing gong
   * @returns {boolean} true if a gong was canceled, false if no gong was playing
   */
  cancelCurrentGong = () => {
    if (this.currentAudioProcess || this.currentAudioPid || this.currentTimeoutId) {
      try {
        console.log('🛑 Attempting to cancel gong, process:', this.currentAudioProcess);
        console.log('🛑 Stored PID:', this.currentAudioPid);

        // Clear any pending timeout
        if (this.currentTimeoutId) {
          clearTimeout(this.currentTimeoutId);
          this.currentTimeoutId = null;
        }

        // Kill the process directly using the helper function
        const pid = this.currentAudioPid || (this.currentAudioProcess && this.currentAudioProcess.pid);

        if (pid) {
          console.log('🛑 Killing process with PID:', pid);
          killAudioProcess(pid);

          // Also kill any related audio players as a fallback
          const { exec } = require('child_process');
          exec('pkill -f "ffplay.*gong" 2>/dev/null; pkill -f "mplayer.*gong" 2>/dev/null; pkill -f "mpg123.*gong" 2>/dev/null', () => {});
        }

        // Also try the standard kill method
        if (this.currentAudioProcess) {
          try {
            this.currentAudioProcess.kill('SIGKILL');
          } catch (e) {
            // Process might already be dead
            console.error('🔊 Failed to kill audio process:', e.message);
            logger.relayAndSoundManager.error('Failed to kill audio process', { error: e });
          }
        }

        logger.relayAndSoundManager.info('RelayAndSoundManager.cancelCurrentGong - Gong canceled by user');
        console.log('🛑 Canceled currently playing gong');

        // Cleanup state
        cleanupZombieProcesses(this);

        // Also turn off relays
        activateRelay(turnRelayPortsOff).catch(err => {
          logger.relayAndSoundManager.error('Failed to turn off relays after cancel', { error: err });
        });

        return true;
      } catch (error) {
        logger.relayAndSoundManager.error('RelayAndSoundManager.cancelCurrentGong ERROR', { error });
        cleanupZombieProcesses(this);
        return false;
      }
    }
    return false;
  };

  /**
   * Check if a gong is currently playing
   * @returns {boolean}
   */
  isGongPlaying = () => this.currentAudioProcess !== null || this.currentAudioPid !== null;

  /**
   * Force cleanup of any stale state (can be called externally for recovery)
   */
  forceCleanup = () => {
    console.log('🧹 Force cleanup of RelayAndSoundManager state');
    if (this.currentTimeoutId) {
      clearTimeout(this.currentTimeoutId);
    }
    if (this.currentAudioPid) {
      killAudioProcess(this.currentAudioPid);
    }
    cleanupZombieProcesses(this);

    // Turn off all relays
    activateRelay(turnRelayPortsOff).catch(err => {
      logger.relayAndSoundManager.error('Failed to turn off relays during force cleanup', { error: err });
    });
  };

  /**
   * Get diagnostic information about the current audio playback state
   * Useful for troubleshooting hangs and debugging
   * @returns {object} Diagnostic info
   */
  getDiagnostics = () => {
    const pid = this.currentAudioPid;
    const processState = getProcessState(pid);
    const elapsedMs = this.currentAudioStartTime ? Date.now() - this.currentAudioStartTime : null;

    const diagnostics = {
      timestamp: new Date().toISOString(),
      isPlaying: this.isGongPlaying(),
      currentAudioPid: pid,
      currentAudioFile: this.currentAudioFile,
      hasTimeout: this.currentTimeoutId !== null,
      elapsedMs,
      processState,
      queueLength: this.runPromisesInQueue.promisesQueue?.length || 0,
      queueIsHandled: this.runPromisesInQueue.isQueueHandled,
    };

    return diagnostics;
  };
}

module.exports = new RelayAndSoundManager();
