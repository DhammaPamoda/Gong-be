const EventEmitter = require('events');
const systemSettingsDal = require('../db/dal/systemSettingsDal');

class SystemSettingsManager extends EventEmitter {
  constructor() {
    super();
    this.settings = null;
  }

  getSettings() {
    if (!this.settings) {
      throw new Error('System settings have not been initialized');
    }
    return this.settings;
  }

  async initializeFromDatabase() {
    this.settings = await systemSettingsDal.getSettings();
    return this.settings;
  }

  async updateSettings(newSettings) {
    this.settings = await systemSettingsDal.updateSettings(newSettings);
    this.emit('settingsUpdated', this.settings);
    return this.settings;
  }

  async updateHk4Enabled(enabled) {
    return this.updateSettings({ hk4Enabled: enabled });
  }
}

module.exports = new SystemSettingsManager();
