/**
 * Wrapper for ftdi-d2xx package to provide ft245rl-compatible API
 * 
 * This wrapper allows the existing relay/index.js code to work with ftdi-d2xx
 * instead of the incompatible ft245rl package.
 * 
 * Usage: Replace `require('ft245rl')` with `require('./ftdi-d2xx-wrapper')`
 * 
 * Note: Requires ftdi-d2xx package to be rebuilt for your system if GLIBC
 * compatibility issues exist.
 */

const EventEmitter = require('events');

let FTDI;
try {
  FTDI = require('ftdi-d2xx');
} catch (error) {
  // Package not available (likely GLIBC compatibility issue)
  // Will be handled by the wrapper functions
  FTDI = null;
}
const logger = require('../lib/logger');

/**
 * Convert port array to byte value
 * @param {number[]} portArray - Array of 0s and 1s (length 4 or 8)
 * @returns {number} Byte value representing port states
 */
function convertPortsArrayToByte(portArray) {
  if (!portArray || !Array.isArray(portArray)) {
    throw new Error('Invalid port array');
  }
  if (portArray.length !== 4 && portArray.length !== 8) {
    throw new Error('Port array must be length 4 or 8');
  }
  
  let byteValue = 0;
  for (let i = 0; i < portArray.length; i++) {
    if (portArray[i] === 1) {
      byteValue |= (1 << i);
    } else if (portArray[i] !== 0) {
      throw new Error('Port array must contain only 0 or 1');
    }
  }
  return byteValue;
}

/**
 * Helper function to open device by deviceInfo
 * @param {Object} deviceInfo - Device info from getDeviceInfoList
 * @returns {Promise<Object>} Opened device
 */
async function openDeviceByInfo(deviceInfo) {
  if (deviceInfo.serial_number && deviceInfo.serial_number.trim() !== '') {
    return await FTDI.openDevice(deviceInfo.serial_number);
  } else if (deviceInfo.description && deviceInfo.description.trim() !== '') {
    return await FTDI.openDevice({ description: deviceInfo.description });
  } else if (deviceInfo.usb_loc_id !== undefined && deviceInfo.usb_loc_id !== 0) {
    return await FTDI.openDevice({ usb_loc_id: deviceInfo.usb_loc_id });
  } else {
    throw new Error(`Cannot open FTDI device: no valid identifier available. Device info: ${JSON.stringify(deviceInfo)}`);
  }
}

/**
 * Wrapper class to mimic ft245rl FtdiDevice behavior
 * Extends EventEmitter to support 'error', 'open', 'data', 'close' events
 */
class FtdiDeviceWrapper extends EventEmitter {
  constructor(deviceInfo, device) {
    super();
    this.deviceInfo = deviceInfo;
    this.device = device;
    this.deviceSettings = {
      description: deviceInfo.description,
      serialNumber: deviceInfo.serial_number,
      vendorId: deviceInfo.usb_vid,
      productId: deviceInfo.usb_pid
    };
  }

  /**
   * Open the device with bit bang mode configuration
   * If device was closed, reopen it first
   */
  async open() {
    // If device was closed, reopen it using stored deviceInfo
    if (!this.device) {
      if (!FTDI) {
        throw new Error('FTDI module not available');
      }
      logger.relayAndSoundManager.info('Reopening closed FTDI device');
      this.device = await openDeviceByInfo(this.deviceInfo);
    }

    // Configure device for bit bang mode (same as original ft245rl)
    try {
      this.device.setTimeouts(1000, 1000);
    } catch (error) {
      logger.relayAndSoundManager.warn('Could not set timeouts', { error: error?.message || error });
    }
    
    // Set bit mode for relay control (sync bit bang with all bits)
    // FT_BITMODE_SYNC_BITBANG = 0x04 (from FTDI constants)
    try {
      this.device.setBitMode(0xff, 0x04); // bitmask 0xff, mode SYNC_BITBANG
    } catch (error) {
      logger.relayAndSoundManager.warn('Could not set bit mode, trying without it', { error: error?.message || error });
      // Some devices may not support bit mode, continue anyway
    }

    // Emit 'open' event for compatibility with ft245rl
    this.emit('open');
  }

  /**
   * Close the device
   */
  async close() {
    if (this.device) {
      try {
        this.device.close();
      } catch (error) {
        logger.relayAndSoundManager.warn('Error closing device', { error: error?.message || error });
      }
      this.device = null;
      // Emit 'close' event for compatibility with ft245rl
      this.emit('close');
    }
  }

  /**
   * Write data to device (for relay control)
   * @param {number[]} dataArray - Array of bytes to write
   */
  async write(dataArray) {
    if (!this.device) {
      throw new Error('Device not open');
    }
    const uint8Array = Uint8Array.from(dataArray);
    await this.device.write(uint8Array);
  }
}

/**
 * Main API object that mimics ft245rl module
 */
const ftdiD2xxWrapper = {
  /**
   * Find first FTDI device (mimics ft245rl.findFirst())
   * @returns {Promise<FtdiDeviceWrapper>}
   */
  async findFirst() {
    if (!FTDI) {
      throw new Error('ftdi-d2xx module is not available. Please rebuild the package for your system (GLIBC compatibility issue).');
    }
    try {
      const deviceList = await FTDI.getDeviceInfoList();
      
      if (!deviceList || deviceList.length === 0) {
        throw new Error('No FTDI device found');
      }

      // Use first device
      const deviceInfo = deviceList[0];
      
      // Log device info for debugging (stringify to see all fields)
      logger.relayAndSoundManager.info(`FTDI device info: ${JSON.stringify(deviceInfo)}`);
      
      // Open device using the helper function
      const device = await openDeviceByInfo(deviceInfo);
      
      const wrapper = new FtdiDeviceWrapper(deviceInfo, device);
      
      // Open device with bit bang configuration
      await wrapper.open();
      
      return wrapper;
    } catch (error) {
      logger.relayAndSoundManager.error('Error finding FTDI device', { error });
      throw error;
    }
  },

  /**
   * Open a device (mimics ft245rl.openDevice())
   * @param {FtdiDeviceWrapper} deviceWrapper - Device wrapper to open
   * @returns {Promise<void>}
   */
  async openDevice(deviceWrapper) {
    if (!FTDI) {
      throw new Error('ftdi-d2xx module is not available. Please rebuild the package for your system.');
    }
    if (!deviceWrapper) {
      throw new Error('Invalid device wrapper');
    }
    // Open will reopen if device was closed
    await deviceWrapper.open();
  },

  /**
   * Close a device (mimics ft245rl.closeDevice())
   * @param {FtdiDeviceWrapper} deviceWrapper - Device wrapper to close
   * @returns {Promise<void>}
   */
  async closeDevice(deviceWrapper) {
    if (deviceWrapper) {
      await deviceWrapper.close();
    }
  },

  /**
   * Switch all ports (mimics ft245rl.switchAllPorts())
   * @param {FtdiDeviceWrapper} deviceWrapper - Device wrapper
   * @param {boolean} isOn - true to turn all on, false to turn all off
   * @returns {Promise<void>}
   */
  async switchAllPorts(deviceWrapper, isOn) {
    if (!deviceWrapper || !deviceWrapper.device) {
      throw new Error('Device not open - call openDevice first');
    }
    const byteValue = isOn ? 0xff : 0x00;
    await deviceWrapper.write([byteValue]);
  },

  /**
   * Switch specific ports (mimics ft245rl.switchPorts())
   * @param {FtdiDeviceWrapper} deviceWrapper - Device wrapper
   * @param {number[]} portArray - Array of 0s and 1s (length 4 or 8)
   * @returns {Promise<void>}
   */
  async switchPorts(deviceWrapper, portArray) {
    if (!deviceWrapper || !deviceWrapper.device) {
      throw new Error('Device not open - call openDevice first');
    }
    if (!portArray || !Array.isArray(portArray)) {
      throw new Error('Invalid port array');
    }
    if (portArray.length !== 4 && portArray.length !== 8) {
      throw new Error('Port array must be length 4 or 8');
    }
    
    const byteValue = convertPortsArrayToByte(portArray);
    await deviceWrapper.write([byteValue]);
  }
};

module.exports = ftdiD2xxWrapper;

