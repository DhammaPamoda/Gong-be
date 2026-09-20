const hk4Dal = require('../db/dal/hk4Dal');

class Hk4Manager {
  constructor() {
    this.settings = null;
  }

  getSequences() {
    if (!this.settings) {
      throw new Error('HK4 settings have not been initialized');
    }
    return this.settings;
  }

  async initializeFromDatabase() {
    this.settings = await hk4Dal.getSequences();
    return this.settings;
  }

  async saveSettings(newSettings) {
    this.settings = await hk4Dal.saveSettings(newSettings);
    return this.settings;
  }

}

module.exports = new Hk4Manager();
