# homebridge-platform-eq3btsmart

EQ-3 Bluetooth Smart Thermostat plugin for [Homebridge](https://github.com/nfarina/homebridge).

# Installation

1. Install Homebridge using: `sudo npm install -g homebridge`
2. Install dependencies, e.g. in Debian based OS's: sudo apt install libusb-dev bluetooth bluez libbluetooth-dev libudev-dev
2. Install this plugin from local clone using: `sudo npm install -g ./homebridge-platform-eq3btsmart --unsafe-perm`
3. Update your configuration file. See the sample below.

# Configuration

## Sample Configuration

```json
"platforms": [{
    "platform": "eq3BTSmart"
}],
```

