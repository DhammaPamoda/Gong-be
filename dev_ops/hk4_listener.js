const InputEvent = require('input-event');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const DEVICE_NAME_PATTERN = /PCsensor_Handle_Keyboard/i; // Pattern to identify the PCsensor keyboard
const BACKEND_URL = 'http://127.0.0.1:3001/api/hardware/hk4';

/**
 * Finds the PCsensor device in /dev/input/by-id/
 */
function findPCsensorDevice() {
    const byIdPath = '/dev/input/by-id/';
    if (!fs.existsSync(byIdPath)) {
        console.error(`Directory ${byIdPath} not found.`);
        return null;
    }

    try {
        const files = fs.readdirSync(byIdPath);
        // Find the keyboard event file (not mouse or if01)
        const deviceFile = files.find(f => DEVICE_NAME_PATTERN.test(f) && f.endsWith('-event-kbd'));

        if (deviceFile) {
            const fullPath = path.join(byIdPath, deviceFile);
            console.log(`Found device: ${fullPath}`);
            return fullPath;
        }
    } catch (err) {
        console.error(`Error reading ${byIdPath}:`, err.message);
    }

    return null;
}

function sendKeyEvent(key) {
    const data = JSON.stringify({ key });
    const options = {
        hostname: '127.0.0.1',
        port: 3001,
        path: '/api/hardware/hk4',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = http.request(options, (res) => {
        if (res.statusCode !== 200) {
            console.error(`Backend returned Status Code: ${res.statusCode}`);
        }
    });

    req.on('error', (error) => {
        console.error('Error sending key event to backend:', error.message);
    });

    req.write(data);
    req.end();
}

function startListener() {
    const devicePath = findPCsensorDevice();
    if (!devicePath) {
        console.error('PCsensor Keyboard not found in /dev/input/by-id/. Retrying in 10 seconds...');
        setTimeout(startListener, 10000);
        return;
    }

    try {
        const input = new InputEvent(devicePath);
        const keyboard = new InputEvent.Keyboard(input);

        console.log(`Listening for events on ${devicePath}...`);

        keyboard.on('keypress', (event) => {
            // event.code is the key code
            // Based on user input 'abcd' for buttons 1234
            // a=30, b=48, c=46, d=32

            let key = null;
            switch (event.code) {
                case 30: // Key 'a'
                    key = '1';
                    break;
                case 48: // Key 'b'
                    key = '2';
                    break;
                case 46: // Key 'c'
                    key = '3';
                    break;
                case 32: // Key 'd'
                    key = '4';
                    break;
            }

            if (key) {
                console.log(`Key ${key} mapped from code ${event.code}`);
                sendKeyEvent(key);
            } else {
                console.log(`Ignored key code: ${event.code}`);
            }
        });

        input.on('error', (err) => {
            console.error('Input device error:', err);
            setTimeout(startListener, 5000);
        });

    } catch (err) {
        console.error(`Failed to open device ${devicePath}:`, err.message);
        if (err.message.includes('EACCES')) {
            console.error('PERMISSION DENIED: Ensure user is in the "input" group.');
        }
        setTimeout(startListener, 10000);
    }
}

startListener();
