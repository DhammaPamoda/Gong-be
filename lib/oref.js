const https = require('https');
const moment = require('moment');
const systemSettingsManager = require('./systemSettingsManager');
const relayAndSoundManager = require('./relayAndSoundManager');
const logger = require('./logger');
const { runSecurityAlarm, EMERGENCY_ACTIVE, EMERGENCY_END, EMERGENCY_PREPARE } = require('../model/israel/activeAlertCategories');
const Gong = require('../model/gong');

const THREE_MINUTES_IN_MS = 3 * 60 * 1000;
const SIREN_GONG_ID = 111;
const END_GONG_ID = 112;
const PREPARE_GONG_ID = 113;

const mapAlertCategoryToGongId = (alertCategory) => {
  switch (alertCategory) {
    case EMERGENCY_ACTIVE:
      return SIREN_GONG_ID;
    case EMERGENCY_END:
      return END_GONG_ID;
    case EMERGENCY_PREPARE:
      return PREPARE_GONG_ID;
  }
};

class OrefManager {
  constructor() {
    this.intervalId = null;
    this.checkInProgress = false;
    this.once = true;
    // Oref API requires specific headers to prevent 403 Forbidden
    this.options = {
      hostname: 'www.oref.org.il',
      port: 443,
      path: '/warningMessages/alert/History/AlertsHistory.json', // Realtime alerts endpoint
      method: 'GET',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        Accept: 'text/plain, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: 'https://www.oref.org.il/12481-he/Pakar.aspx',
      },
    };
    this.recentAlertCategory = null;
    this.recentAlertTime = 0;
  }

  init() {
    this.updatePolling(systemSettingsManager.getSettings());

    systemSettingsManager.on('settingsUpdated', (settings) => {
      this.updatePolling(settings);
    });
  }

  updatePolling(settings) {
    const { runSecurityCheck } = settings;
    const pollingIntervalSec = settings.pollingInterval || 10;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (runSecurityCheck) {
      logger.log('info', `[Oref] Starting polling every ${pollingIntervalSec} seconds for location: ${settings.alertLocation}`);
      this.intervalId = setInterval(() => this.checkOref(), pollingIntervalSec * 1000);
    } else {
      logger.log('info', '[Oref] Polling is disabled.');
    }
  }

  checkOref() {
    if (this.checkInProgress) return;
    this.checkInProgress = true;

    const req = https.request(this.options, (res) => {
      if (res.statusCode !== 200) {
        this.checkInProgress = false;
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        this.checkInProgress = false;
        // The API returns empty string if there are no alerts
        if (data.trim() === '') {
          return;
        }

        try {
          // Check for UTF-16 LE BOM which oref frequently uses
          if (data.charCodeAt(0) === 0xFEFF) {
            data = data.slice(1);
          }
          const alerts = JSON.parse(data);
          this.processAlerts(alerts);
        } catch (e) {
          console.log('parse error ln 84: ', e.message);
          logger.error(`[Oref] parse error: ${e.message}`);
        }
      });
    });

    req.on('error', (e) => {
      this.checkInProgress = false;
      logger.error(`[Oref] http error: ${e.message}`);
    });

    req.end();
  }

  processAlerts(data) {
    const settings = systemSettingsManager.getSettings();
    if (!settings.runSecurityCheck) {
      console.log('runSecurityCheck is false');
      return;
    }

    const locationToMatch = settings.alertLocation.trim();
    // console.log("testing: ", settings.testing);

    data.forEach(alert => {
      const alertTime = alert.alertDate;
      const alertLocation = alert.data.trim();
      if (!alertLocation.includes(locationToMatch)) {
        return;
      }
      if (Date.now() - moment(alertTime).valueOf() > THREE_MINUTES_IN_MS
                || moment(alertTime).valueOf() <= moment(this.recentAlertTime).valueOf()
      ) {
        return;
      }

      const alertCategory = alert.category;
      // console.log("location match and time match", alert)
      if (!settings.supportedAlertCategories.includes(alertCategory)) {
        return;
      }

      if (runSecurityAlarm(alertCategory, this.recentAlertCategory, alertTime, this.recentAlertTime)) {
        console.log('recentAlertTime: ', this.recentAlertTime);
        console.log('recentAlertCategory: ', this.recentAlertCategory);

        this.recentAlertCategory = alertCategory;
        this.recentAlertTime = alertTime;
        console.log('\nwarn', `[Oref] Alert match found for location ${locationToMatch}! Triggering gong.\n`);
        console.log('alertCategory: ', alertCategory);
        const gongType = mapAlertCategoryToGongId(alertCategory);
        const gongToPlay = new Gong(gongType, settings.areas);

        if (settings.testing) {
          console.log('\n[Oref] Testing mode ON - Simulated gong execution', { alertCategory, locationToMatch, alertTime }, '\n');
        } else {
          relayAndSoundManager.playImmediateGong(gongToPlay);
        }
      }
    });
  }
}

module.exports = new OrefManager();
