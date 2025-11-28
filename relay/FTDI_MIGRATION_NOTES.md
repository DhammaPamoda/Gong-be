# FTDI Package Migration Notes

## Current Status

The `ft245rl@1.3.3` package is **incompatible with Node.js v18.20.8** due to deprecated V8 APIs. The application currently works without it (relay functionality is gracefully disabled).

## Alternative Package: `ftdi-d2xx@1.3.1`

### Installation Status
- ✅ Package installed successfully via npm
- ⚠️ **GLIBC Compatibility Issue**: Pre-compiled binary requires GLIBC 2.33, but system has GLIBC 2.31
- **Solution**: Package needs to be rebuilt from source using `cmake-js rebuild`

### Rebuild Requirements
```bash
cd node_modules/ftdi-d2xx
npm run cmake:rebuild-release
```

**Required tools:**
- CMake
- cmake-js (npm install -g cmake-js)
- Build tools (g++, make)

### API Mapping

#### Current ft245rl API → ftdi-d2xx API

| ft245rl | ftdi-d2xx | Notes |
|---------|-----------|-------|
| `ftdi.findFirst()` | `FTDI.getDeviceInfoList()` then `FTDI.openDevice(serial_number)` | Returns array, need to select first device |
| `ftdi.openDevice(device)` | `device = await FTDI.openDevice(serial_number)` | Device object returned directly |
| `ftdi.switchAllPorts(device, isOn)` | `device.write(isOn ? [0xff] : [0x00])` | Write byte directly |
| `ftdi.switchPorts(device, portArray)` | Convert array to byte, then `device.write([byte])` | Need conversion function |
| `ftdi.closeDevice(device)` | `device.close()` | Same concept |

### Relay Control Implementation

The relay control works by:
1. Opening device in **bit bang mode** (sync mode with bitmask 0xff)
2. Writing bytes directly to control relay ports:
   - `0xff` = all ports ON
   - `0x00` = all ports OFF
   - Custom byte = specific port pattern

**Port array to byte conversion:**
- Array `[1,0,1,0]` (4 ports) → binary `1010` → byte `0x0A`
- Array `[1,1,1,1,0,0,0,0]` (8 ports) → binary `11110000` → byte `0xF0`

### Device Configuration

The original ft245rl opens devices with:
- Baudrate: 9600
- Databits: 8
- Stopbits: 1
- Parity: none
- Bitmode: sync (bit bang)
- Bitmask: 0xff

With ftdi-d2xx, this would be:
```javascript
device.setBitMode(0xff, FTDI.FT_BITMODE_SYNC_BITBANG);
```

## Implementation Plan

1. **Create wrapper module** (`relay/ftdi-d2xx-wrapper.js`) that mimics ft245rl API
2. **Update relay/index.js** to try ftdi-d2xx wrapper if ft245rl fails
3. **Test after rebuilding** ftdi-d2xx package

## Current Workaround

The application gracefully handles the missing module:
- Relay functionality is disabled
- Warning logged: "ft245rl module is not available. Relay functionality will be disabled."
- Application continues to function normally

## References

- ftdi-d2xx GitHub: https://github.com/motla/ftdi-d2xx
- ftdi-d2xx npm: https://www.npmjs.com/package/ftdi-d2xx
- FTDI D2XX Programmer's Guide: https://ftdichip.com/wp-content/uploads/2020/08/D2XX_Programmers_GuideFT_000071.pdf

