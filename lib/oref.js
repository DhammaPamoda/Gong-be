const https = require('https');
const gongsManager = require('./gongsManager');
const systemSettingsManager = require('./systemSettingsManager');
const moment = require('moment');
const logger = require('./logger');

class OrefManager {
    constructor() {
        this.intervalId = null;
        this.checkInProgress = false;
        // Oref API requires specific headers to prevent 403 Forbidden
        this.options = {
            hostname: 'www.oref.org.il',
            port: 443,
            path: '/warningMessages/alert/alerts.json', // Realtime alerts endpoint
            method: 'GET',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                'Accept': 'text/plain, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://www.oref.org.il/12481-he/Pakar.aspx'
            }
        };
        this.recentAlerts = new Set();
    }

    init() {
        this.updatePolling(systemSettingsManager.getSettings());

        systemSettingsManager.on('settingsUpdated', (settings) => {
            this.updatePolling(settings);
        });
    }

    updatePolling(settings) {
        const runSecurityCheck = settings.runSecurityCheck;
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
                    logger.error('[Oref] parse error: ' + e.message);
                }
            });
        });

        req.on('error', (e) => {
            this.checkInProgress = false;
            logger.error('[Oref] http error: ' + e.message);
        });

        req.end();
    }

    processAlerts(data) {
        if (!data || !data.data || !Array.isArray(data.data)) return;

        const settings = systemSettingsManager.getSettings();
        if (!settings.runSecurityCheck) return;

        const locationToMatch = settings.alertLocation.trim();
        if (!locationToMatch) return;

        const alertId = data.id;

        // Check if location matches and we haven't processed this specific alert ID recently
        if (data.data.includes(locationToMatch) && !this.recentAlerts.has(alertId)) {
            logger.log('warn', `[Oref] Alert match found for location ${locationToMatch}! Triggering gong.`);

            this.recentAlerts.add(alertId);
            // Clean up old alerts after 5 minutes
            setTimeout(() => {
                this.recentAlerts.delete(alertId);
            }, 5 * 60 * 1000);

            const timeStr = moment().format('HH:mm:ss');

            // Type 5: "Active" / Siren
            gongsManager.addManualGong({
                gongType: 5,
                volume: 100, // assume max volume for emergency
                isActive: true, // for realtime manual
                time: timeStr
            });
        }
    }
}

module.exports = new OrefManager();
