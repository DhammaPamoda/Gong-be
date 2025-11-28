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
   */
  async open() {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    // Configure device for bit bang mode (same as original ft245rl)
    // Note: ftdi-d2xx uses different API, may need adjustment
    this.device.setTimeouts(1000, 1000);
    
    // Set bit mode for relay control (sync bit bang with all bits)
    // FT_BITMODE_SYNC_BITBANG = 0x04 (from FTDI constants)
    try {
      this.device.setBitMode(0xff, 0x04); // bitmask 0xff, mode SYNC_BITBANG
    } catch (error) {
      logger.relayAndSoundManager.warn('Could not set bit mode, trying without it', { error });
      // Some devices may not support bit mode, continue anyway
    }

    // Emit 'open' event for compatibility with ft245rl
    this.emit('open');
    return Promise.resolve();
  }

  /**
   * Close the device
   */
  async close() {
    if (this.device) {
      this.device.close();
      this.device = null;
      // Emit 'close' event for compatibility with ft245rl
      this.emit('close');
    }
    return Promise.resolve();
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
    return Promise.resolve();
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
      
      // Try to open by serial number first, fall back to other identifiers if serial is empty
      // API accepts: serial_number (string), usb_loc_id (number), or description (string)
      let device;
      if (deviceInfo.serial_number && deviceInfo.serial_number.trim() !== '') {
        logger.relayAndSoundManager.info('Opening FTDI by serial number', { serial: deviceInfo.serial_number });
        device = await FTDI.openDevice(deviceInfo.serial_number);
      } else if (deviceInfo.description && deviceInfo.description.trim() !== '') {
        // Open by description when serial number is empty
        logger.relayAndSoundManager.info('Opening FTDI by description', { description: deviceInfo.description });
        device = await FTDI.openDevice({ description: deviceInfo.description });
      } else if (deviceInfo.usb_loc_id !== undefined && deviceInfo.usb_loc_id !== 0) {
        // Open by USB location ID
        logger.relayAndSoundManager.info('Opening FTDI by usb_loc_id', { usb_loc_id: deviceInfo.usb_loc_id });
        device = await FTDI.openDevice({ usb_loc_id: deviceInfo.usb_loc_id });
      } else {
        // No valid identifier available - throw descriptive error
        throw new Error(`Cannot open FTDI device: no valid identifier available. Device info: ${JSON.stringify(deviceInfo)}`);
      }
      
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
    if (!deviceWrapper || !deviceWrapper.device) {
      throw new Error('Invalid device');
    }
    // Device is already open when created, just ensure it's configured
    await deviceWrapper.open();
    return Promise.resolve();
  },

  /**
   * Close a device (mimics ft245rl.closeDevice())
   * @param {FtdiDeviceWrapper} deviceWrapper - Device wrapper to close
   * @returns {Promise<void>}
   */
  async closeDevice(deviceWrapper) {
    if (!FTDI) {
      throw new Error('ftdi-d2xx module is not available. Please rebuild the package for your system.');
    }
    if (deviceWrapper) {
      await deviceWrapper.close();
    }
    return Promise.resolve();
  },

  /**
   * Switch all ports (mimics ft245rl.switchAllPorts())
   * @param {FtdiDeviceWrapper} deviceWrapper - Device wrapper
   * @param {boolean} isOn - true to turn all on, false to turn all off
   * @returns {Promise<void>}
   */
  async switchAllPorts(deviceWrapper, isOn) {
    if (!FTDI) {
      throw new Error('ftdi-d2xx module is not available. Please rebuild the package for your system.');
    }
    if (!deviceWrapper || !deviceWrapper.device) {
      throw new Error('Invalid device');
    }
    const byteValue = isOn ? 0xff : 0x00;
    await deviceWrapper.write([byteValue]);
    return Promise.resolve();
  },

  /**
   * Switch specific ports (mimics ft245rl.switchPorts())
   * @param {FtdiDeviceWrapper} deviceWrapper - Device wrapper
   * @param {number[]} portArray - Array of 0s and 1s (length 4 or 8)
   * @returns {Promise<void>}
   */
  async switchPorts(deviceWrapper, portArray) {
    if (!FTDI) {
      throw new Error('ftdi-d2xx module is not available. Please rebuild the package for your system.');
    }
    if (!deviceWrapper || !deviceWrapper.device) {
      throw new Error('Invalid device');
    }
    if (!portArray || !Array.isArray(portArray)) {
      throw new Error('Invalid port array');
    }
    if (portArray.length !== 4 && portArray.length !== 8) {
      throw new Error('Port array must be length 4 or 8');
    }
    
    const byteValue = convertPortsArrayToByte(portArray);
    await deviceWrapper.write([byteValue]);
    return Promise.resolve();
  }
};

module.exports = ftdiD2xxWrapper;

