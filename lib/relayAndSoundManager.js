const path = require('path');
const fs = require('fs');
const os = require('os');
const players = [
  'mplayer',
  'afplay',
  'ffplay',
  'mpg123',
  'mpg321',
  'play',
  'omxplayer',
  'aplay',
  'cmdmp3'
];
const player = require('play-sound')({ players, });

const logger = require('../lib/logger');
const RunPromiseRoutineInQueue = require('./utils/runPromiseRoutineInQueue');
const utilsManager = require('./utilsManager');
const relaysModule = require('../relay');

// FTDI status log for tracking relay accessibility
const FTDI_LOG_DIR = path.join(os.homedir(), '.local/share/gong/logs');
const FTDI_LOG_FILE = path.join(FTDI_LOG_DIR, 'ftdi_status.log');

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
 *
 * @param {module.Gong} aGongToPlay
 * @return {Promise<any>}
 */
const playSoundGong = (aGongToPlay, relayAndSoundManagerInstance) => {
  let { volume, repeat } = aGongToPlay;
  volume = (Number.isNaN(Number(volume)) || volume < 1 || volume > 100) ? 100 : volume;
  repeat = (Number.isNaN(Number(repeat)) || repeat < 1 || repeat > 20) ? 1 : repeat;

  const options = {
    mplayer: ['-ao pulse', `-volume ${volume}`, `-loop ${repeat}`],
    ffplay: ['-nodisp', '-autoexit', '-loglevel quiet', `-af volume=${volume / 100}`, `-loop ${repeat}`, '-noborder'],
    shell: true,
    cwd: soundPath,
  };

  let { gongType } = aGongToPlay;
  gongType = Number.isNaN(Number(gongType)) ? 0 : gongType;
  const whatGongType = utilsManager.gongsMap.get(gongType) || utilsManager.gongsMap.get(0);

  return new Promise((resolve, reject) => {
    // Store the audio process so we can cancel it if needed
    const audioProcess = player.play(whatGongType.pathName, options, (err) => {
      relayAndSoundManagerInstance.currentAudioProcess = null; // Clear when done
      relayAndSoundManagerInstance.currentAudioPid = null; // Clear PID when done
      if (err && !err.killed) { // Don't reject if manually killed
        reject(err);
      } else {
        resolve(true);
      }
    });
    
    // Store the current audio process for potential cancellation
    relayAndSoundManagerInstance.currentAudioProcess = audioProcess;
    
    // Also store the PID for direct killing
    if (audioProcess && audioProcess.pid) {
      relayAndSoundManagerInstance.currentAudioPid = audioProcess.pid;
      console.log('🎵 Started audio process with PID:', audioProcess.pid);
    }
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
    this.runPromisesInQueue = new RunPromiseRoutineInQueue((aPayload) => {
      return orchestrateGong(aPayload, this);
    });
  }

  /**
   *
   * @param {module.Job} aGongToPlayJob
   * @param {Date} aFireDate
   */
  playGongForJob = (aGongToPlayJob, aFireDate) => {
    return this.runPromisesInQueue.run(aGongToPlayJob.data)
      .then(() => {
        logger.relayAndSoundManager.info('RelayAndSoundManager.playGongForJob ',
          {
            job: aGongToPlayJob,
            execTime: aFireDate,
          });
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
  };

  /**
   *
   * @param {module.Gong} aGongToPlay
   */
  playImmediateGong = (aGongToPlay) => {
    return this.runPromisesInQueue.run(aGongToPlay)
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
  };

  /**
   * Cancel the currently playing gong
   * @returns {boolean} true if a gong was canceled, false if no gong was playing
   */
  cancelCurrentGong = () => {
    if (this.currentAudioProcess || this.currentAudioPid) {
      try {
        console.log('🛑 Attempting to cancel gong, process:', this.currentAudioProcess);
        console.log('🛑 Stored PID:', this.currentAudioPid);
        
        // Kill the process directly using system command
        const { exec } = require('child_process');
        const pid = this.currentAudioPid || (this.currentAudioProcess && this.currentAudioProcess.pid);
        
        if (pid) {
          console.log('🛑 Killing process with PID:', pid);
          // Kill all audio players that might be playing gong files
          exec(`pkill -f "ffplay.*gong" 2>/dev/null || true`, (error, stdout, stderr) => {
            // Suppress all error messages for pkill commands
          });
          
          exec(`pkill -f "mplayer.*gong" 2>/dev/null || true`, (error, stdout, stderr) => {
            // Suppress all error messages for pkill commands
          });
          
          exec(`pkill -f "mpg123.*gong" 2>/dev/null || true`, (error, stdout, stderr) => {
            // Suppress all error messages for pkill commands
          });
          
          // Also try direct kill
          exec(`kill -9 ${pid} 2>/dev/null || true`, (error, stdout, stderr) => {
            // Suppress all error messages for kill commands
          });
        }
        
        // Also try the standard kill method
        if (this.currentAudioProcess) {
          this.currentAudioProcess.kill('SIGKILL');
        }
        
        logger.relayAndSoundManager.info('RelayAndSoundManager.cancelCurrentGong - Gong canceled by user');
        console.log('🛑 Canceled currently playing gong');
        this.currentAudioProcess = null;
        this.currentAudioPid = null;
        
        // Also turn off relays
        activateRelay(turnRelayPortsOff).catch(err => {
          logger.relayAndSoundManager.error('Failed to turn off relays after cancel', { error: err });
        });
        
        return true;
      } catch (error) {
        logger.relayAndSoundManager.error('RelayAndSoundManager.cancelCurrentGong ERROR', { error });
        this.currentAudioProcess = null;
        this.currentAudioPid = null;
        return false;
      }
    }
    return false;
  };

  /**
   * Check if a gong is currently playing
   * @returns {boolean}
   */
  isGongPlaying = () => {
    return this.currentAudioProcess !== null || this.currentAudioPid !== null;
  };
}

module.exports = new RelayAndSoundManager();
