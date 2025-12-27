const { exec } = require('child_process');
let ftdi;
try {
  ftdi = require('./ftdi-d2xx-wrapper');
} catch (e) {
  ftdi = null;
}
const logger = require('../lib/logger');
const RunPromiseRoutineInQueue = require('../lib/utils/runPromiseRoutineInQueue');
const ExecError = require('../model/execError');

const NO_OF_PORTS = process.env.NO_OF_PORTS ? Number.parseInt(process.env.NO_OF_PORTS, 10) : 4;

/**
 * @param {number[]} aRelayPortsArray
 * @return {string}
 */
const convertPortsArrayToBinNumber = (aRelayPortsArray) => {
  const binArray = new Array(NO_OF_PORTS).fill('0');
  aRelayPortsArray.forEach((portNumber) => {
    if (portNumber > 0 && portNumber <= NO_OF_PORTS) {
      binArray[portNumber - 1] = '1';
    }
  });
  return binArray.join('');
};


const setOnDeviceListeners = (aDevice) => {
  aDevice.on('error', (error) => {
    logger.relayAndSoundManager.error('DEVICE EMITTER : ON ERROR !!!', { error });
  });
  aDevice.on('open', () => {
    logger.relayAndSoundManager.info('DEVICE EMITTER : ON OPEN !!!');
  });
  aDevice.on('data', (data) => {
    logger.relayAndSoundManager.info(`DEVICE EMITTER : ON DATA !!! data = ${data}`);
  });
  aDevice.on('close', () => {
    logger.relayAndSoundManager.info('DEVICE EMITTER : ON CLOSE !!!');
  });
  console.log('GO DEVICE !!!', aDevice);
};

/**
 *
 * @param {RelaysModule} aRelaysModuleObject
 * @return {Promise<any>}
 */
const findDevice = (aRelaysModuleObject) => {
  const retDevicePromise = new Promise((resolve, reject) => {
    if (!ftdi) {
      const error = new Error('ft245rl module is not available. Please install FTDI drivers and rebuild the module.');
      logger.relayAndSoundManager.error('FTDI module not available', { error });
      aRelaysModuleObject.setFtdiDevice(null);
      reject(error);
      return;
    }
    ftdi.findFirst().then((device) => {
      const { description, serialNumber, vendorId, productId } = device.deviceSettings;
      const foundPref = '################## Found Device';
      logger.relayAndSoundManager
        .info(`${foundPref} : ${serialNumber} ${description} vendorId :${vendorId} productId: ${productId}`);
      setOnDeviceListeners(device);
      aRelaysModuleObject.setFtdiDevice(device);
      resolve(device);
    }).catch((err) => {
      aRelaysModuleObject.setFtdiDevice(null);
      reject(err);
    });
  });
  return retDevicePromise;
};

/**
 *
 * @param {RelaysModule} aRelaysModuleObject
 * @param aCommandToRun
 * @param aWithDevice
 * @param aIsFirstCall
 * @return {Promise<any>}
 */
const runCommandInQueue = (aRelaysModuleObject, aCommandToRun) => {
  const errorPrefix = 'RelaysModule::runCommandInQueue ';
  let deviceIsReadyPromise = Promise.resolve(true);
  if (!aRelaysModuleObject.FtdiDevice) {
    deviceIsReadyPromise = findDevice(aRelaysModuleObject);
  }
  const promiseResult = new Promise((resolve, reject) => {
    deviceIsReadyPromise.then(() => {
      aRelaysModuleObject.runPromisesInQueue.run(aCommandToRun)
        .then((resolveResult) => {
          resolve(resolveResult);
        })
        .catch((error) => {
          logger.relayAndSoundManager.error(`${errorPrefix} Error in executing command (${aCommandToRun})`, { error });
          reject(error);
        });
    }).catch((error) => {
      logger.relayAndSoundManager.error(`${errorPrefix} Couldn't execute command (${aCommandToRun})`, { error });
      reject(error);
    });
  });
  return promiseResult;
};


const openDevice = (aRelaysModuleObject, aIsFirstTry = true) => {
  const retPromise = new Promise((resolve, reject) => {
    if (!ftdi) {
      const error = new Error('ft245rl module is not available. Please install FTDI drivers and rebuild the module.');
      logger.relayAndSoundManager.error('FTDI module not available for opening device', { error });
      reject(error);
      return;
    }
    ftdi.openDevice(aRelaysModuleObject.FtdiDevice).then(() => {
      resolve(true);
    }).catch((error) => {
      // If linux - trying to rmmod the serial drivers to connect only with the FTDI library
      if (aIsFirstTry && process.platform == 'linux') {
        exec('rmmod ftdi_sio', (err, stdout, stderr) => {
          if (err !== null) {
            reject(new ExecError(err, stderr));
          } else {
            // Trying to get the device and open it again
            findDevice(aRelaysModuleObject).then(() => {
              openDevice(aRelaysModuleObject, false).then(() => resolve(true)).catch((secOpenErr) => {
                reject(secOpenErr);
              });
            }).catch((secFindErr) => {
              reject(secFindErr);
            });
          }
        });
      } else {
        reject(error);
      }
    });
  });
  return retPromise;
};

/**
 * Check if an error indicates the device was disconnected and needs re-discovery
 * @param {Error} error - The error to check
 * @returns {boolean} true if this appears to be a device disconnection error
 */
const isDeviceDisconnectedError = (error) => {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return (
    message.includes('device not found') ||
    message.includes('device not open') ||
    message.includes('no such device') ||
    message.includes('device disconnected') ||
    message.includes('usb') ||
    message.includes('i/o error') ||
    message.includes('ft_io_error') ||
    message.includes('ft_device_not_found') ||
    message.includes('ft_device_not_opened') ||
    error.code === 'ENODEV' ||
    error.code === 'EIO'
  );
};

/**
 * Attempt to re-discover and open the device after a disconnection
 * @param {RelaysModule} aRelaysModuleObject
 * @returns {Promise<boolean>} true if device was successfully re-discovered
 */
const attemptDeviceRecovery = async (aRelaysModuleObject) => {
  logger.relayAndSoundManager.info('Attempting FTDI device recovery after disconnection...');
  
  // Clear the old device handle
  aRelaysModuleObject.FtdiDevice = null;
  
  try {
    await findDevice(aRelaysModuleObject);
    logger.relayAndSoundManager.info('FTDI device successfully re-discovered and opened');
    return true;
  } catch (error) {
    logger.relayAndSoundManager.error('FTDI device recovery failed - device may be disconnected', { error });
    return false;
  }
};

const callBetweenOpenAndClose = (aRelaysModuleObject, aCallBackFunc, aIsRetry = false) => {
  const retPromise = new Promise((resolve, reject) => {
    openDevice(aRelaysModuleObject).then(() => {
      let error;
      aCallBackFunc()
        .catch((err) => {
          error = err;
          logger.relayAndSoundManager.error('Failed to activate action on device', { error: err });
        })
        .finally(async () => {
          // NOTE: We intentionally do NOT close the device after each operation.
          // Closing and reopening the FTDI device for every relay operation causes
          // race conditions when operations happen in quick succession (e.g., cancel
          // right after play). The USB/FTDI driver may not have fully released the
          // device before we try to reopen it, causing hangs.
          // The device will be closed when the process exits or on explicit cleanup.
          
          if (error) {
            // Check if this is a device disconnection error and attempt recovery
            if (!aIsRetry && isDeviceDisconnectedError(error)) {
              const recovered = await attemptDeviceRecovery(aRelaysModuleObject);
              if (recovered) {
                // Retry the operation once after recovery
                logger.relayAndSoundManager.info('Retrying operation after device recovery...');
                callBetweenOpenAndClose(aRelaysModuleObject, aCallBackFunc, true)
                  .then(resolve)
                  .catch(reject);
                return;
              }
            }
            reject(error);
          } else {
            resolve(true);
          }
        });
    }).catch(async (error) => {
      logger.relayAndSoundManager.error('Failed to open device', { error });
      
      // If open failed due to disconnection and this is not already a retry, attempt recovery
      if (!aIsRetry && isDeviceDisconnectedError(error)) {
        const recovered = await attemptDeviceRecovery(aRelaysModuleObject);
        if (recovered) {
          // Retry the operation once after recovery
          logger.relayAndSoundManager.info('Retrying operation after device recovery...');
          callBetweenOpenAndClose(aRelaysModuleObject, aCallBackFunc, true)
            .then(resolve)
            .catch(reject);
          return;
        }
      }
      reject(error);
    });
  });
  return retPromise;
};

/**
 *
 * @param {RelaysModule} aRelaysModuleObject
 * @return
 */
const functionToRunCommands = (aRelaysModuleObject) => {
  const errorPrefix = 'RelaysModule::functionToRunCommands ';
  return (aPayload) => {
    return new Promise((resolve, reject) => {
      const tokensArray = aPayload.split(' ');
      if (!tokensArray || tokensArray.length < 2 || (tokensArray[1] !== 'find' && tokensArray.length < 3)) {
        reject(new Error(`${errorPrefix}. Invalid command : ${aPayload}`));
        return;
      }
      if ((tokensArray[1] !== 'find' && !aRelaysModuleObject.FtdiDevice)) {
        reject(new Error(`${errorPrefix}. FTDI device not set. Command : ${aPayload}`));
        return;
      }

      if (!ftdi) {
        reject(new Error(`${errorPrefix}. ft245rl module is not available. Please install FTDI drivers and rebuild the module. Command : ${aPayload}`));
        return;
      }

      let isOn;
      let portOnArray;
      switch (tokensArray[1]) {
        case 'find':
          ftdi.findFirst().then((device) => {
            resolve(device);
          })
            .catch((err => reject(err)));
          break;
        case 'all':
          isOn = tokensArray[2] === '1';
          callBetweenOpenAndClose(aRelaysModuleObject,
            () => ftdi.switchAllPorts(aRelaysModuleObject.FtdiDevice, isOn))
            .then(() => resolve(true))
            .catch((err) => reject(err));
          break;
        case 'turn':
          portOnArray = Array.from(tokensArray[2]).map((x => Number.parseInt(x, 10)));
          callBetweenOpenAndClose(aRelaysModuleObject,
            () => ftdi.switchPorts(aRelaysModuleObject.FtdiDevice, portOnArray))
            .then(() => resolve(true))
            .catch((err) => reject(err));
          break;
        default:
          reject(new Error(`${errorPrefix}. Could not interpret payload : ${aPayload}`));
          break;
      }
    }); // Of ret Promise
  };
};


class RelaysModule {
  constructor() {
    const errorPrefix = 'RelaysModule::constructor';
    this.FtdiDevice = null;
    this.runPromisesInQueue = new RunPromiseRoutineInQueue(functionToRunCommands(this));

    if (!ftdi) {
      logger.relayAndSoundManager.warn(`${errorPrefix} FTDI module (ftdi-d2xx) is not available. Relay functionality will be disabled. Please rebuild ftdi-d2xx package for your system (see relay/FTDI_MIGRATION_NOTES.md for details).`);
      return;
    }

    findDevice(this).then(() => {
      logger.relayAndSoundManager.info(`${errorPrefix} Managed to get handle to device`);

    }).catch((error) => {
      logger.relayAndSoundManager.error(`${errorPrefix} Couldn't connect to device`, { error });
    });
  }

  setFtdiDevice(value) {
    this.FtdiDevice = value;
  }

  /**
   * @param {number[]} aRelayPortsNumbersArray
   * @returns {Promise|Promise<any>}
   */
  turnRelayPortsOn(aRelayPortsNumbersArray) {
    if (!aRelayPortsNumbersArray || !Array.isArray(aRelayPortsNumbersArray)
      || aRelayPortsNumbersArray.some(value => (value < 0 || value > NO_OF_PORTS))) {
      const newError = new Error(`RelaysModule::turnRelayPortsOn Invalid input array : ${aRelayPortsNumbersArray}`);
      return Promise.reject(newError);
    }
    if (aRelayPortsNumbersArray.includes(0)) {
      return this.setRelayPortsAll(true);
    }
    const relayPortsToTurnBinNumber = convertPortsArrayToBinNumber(aRelayPortsNumbersArray);
    const setStatusCommand = `${NO_OF_PORTS} turn ${relayPortsToTurnBinNumber}`;
    return runCommandInQueue(this, setStatusCommand);
  }

  /**
   * @param {boolean} aIsOn
   * @returns {Promise|Promise<any>}
   */
  setRelayPortsAll(aIsOn = true) {
    const newCurrentStatus = aIsOn ? 1 : 0;
    const setRelayCommand = `${NO_OF_PORTS} all ${newCurrentStatus}`;
    const run = runCommandInQueue(this, setRelayCommand);
    return run;
  }

  /**
   * Check if the FTDI device is connected and healthy
   * Should be called before scheduled gongs to ensure device is ready
   * @returns {Promise<{connected: boolean, recovered: boolean, error: string|null}>}
   */
  async checkDeviceHealth() {
    const result = { connected: false, recovered: false, error: null };
    
    if (!ftdi) {
      result.error = 'FTDI module not available';
      return result;
    }

    // Check if we have a device handle
    if (!this.FtdiDevice) {
      logger.relayAndSoundManager.warn('RelaysModule::checkDeviceHealth - No device handle, attempting to find device...');
      try {
        await findDevice(this);
        result.connected = true;
        result.recovered = true;
        logger.relayAndSoundManager.info('RelaysModule::checkDeviceHealth - Device found and connected');
      } catch (error) {
        result.error = error.message || 'Failed to find device';
        logger.relayAndSoundManager.error('RelaysModule::checkDeviceHealth - Failed to find device', { error });
      }
      return result;
    }

    // We have a device handle, verify it's still working
    try {
      if (typeof this.FtdiDevice.checkHealth === 'function') {
        const healthy = await this.FtdiDevice.checkHealth();
        if (healthy) {
          result.connected = true;
          return result;
        }
      } else {
        // No health check method, assume device is connected if handle exists
        result.connected = true;
        return result;
      }
    } catch (error) {
      logger.relayAndSoundManager.warn('RelaysModule::checkDeviceHealth - Health check failed', { error: error?.message || error });
    }

    // Device handle exists but is not healthy, attempt recovery
    logger.relayAndSoundManager.info('RelaysModule::checkDeviceHealth - Device unhealthy, attempting recovery...');
    const recovered = await attemptDeviceRecovery(this);
    result.connected = recovered;
    result.recovered = recovered;
    if (!recovered) {
      result.error = 'Device recovery failed - device may be disconnected';
    }
    return result;
  }

  /**
   * Check if the FTDI module is available
   * @returns {boolean}
   */
  isModuleAvailable() {
    return !!ftdi;
  }
}

module.exports = new RelaysModule();
