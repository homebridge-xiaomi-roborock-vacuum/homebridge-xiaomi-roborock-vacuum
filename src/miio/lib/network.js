"use strict";

const EventEmitter = require("events");
const dgram = require("dgram");

const debug = require("debug");

const Packet = require("./packet");
const DeviceInfo = require("./device_info");
const PORT = 54321;

/**
 * Class for keeping track of the current network of devices. This is used to
 * track a few things:
 *
 * 1) Mapping between adresses and device identifiers. Used when connecting to
 * a device directly via IP or hostname.
 *
 * 2) Mapping between id and detailed device info such as the model.
 *
 */
class Network extends EventEmitter {
  constructor() {
    super();

    this.packet = new Packet(true);

    this.addresses = new Map();
    this.devices = new Map();

    this.references = 0;
    this.debug = debug("miio:network");
  }

  search() {
    this.packet.handshake();
    const data = Buffer.from(this.packet.raw);
    this.socket.send(data, 0, data.length, PORT, "255.255.255.255");

    // Broadcast an extra time in 500 milliseconds in case the first brodcast misses a few devices
    setTimeout(() => {
      this.socket.send(data, 0, data.length, PORT, "255.255.255.255");
    }, 500);
  }

  findDevice(id, rinfo) {
    // First step, check if we know about the device based on id
    let device = this.devices.get(id);
    if (!device && rinfo) {
      // If we have info about the address, try to resolve again
      device = this.addresses.get(rinfo.address);

      if (!device) {
        // No device found, keep track of this one
        device = new DeviceInfo(this, id, rinfo.address, rinfo.port);
        this.devices.set(id, device);
        this.addresses.set(rinfo.address, device);

        return device;
      }
    }

    return device;
  }

  async findDeviceViaAddress(options) {
    if (!this.socket) {
      throw new Error(
        "Implementation issue: Using network without a reference"
      );
    }

    let device = this.addresses.get(options.address);
    if (!device) {
      // No device was found at the address, try to discover it
      device = new DeviceInfo(
        this,
        null,
        options.address,
        options.port || PORT
      );
      this.addresses.set(options.address, device);
    }

    // Update the token if we have one
    if (typeof options.token === "string") {
      device.token = Buffer.from(options.token, "hex");
    } else if (options.token instanceof Buffer) {
      device.token = options.token;
    }

    // Set the model if provided
    if (!device.model && options.model) {
      device.model = options.model;
    }

    // Perform a handshake with the device to see if we can connect
    try {
      await device.handshake();
    } catch (err) {
      // Supress missing tokens - enrich should take care of that
      if (err.code !== "missing-token") {
        throw err;
      }
    }

    const cachedDevice = this.cacheDevice(device);
    await cachedDevice.enrich();
    return cachedDevice;
  }

  /**
   * Caches the device if not previously cached (could be the reason of failures when reconnecting?)
   * @private
   * @param device {@link DeviceInfo}
   * @returns {DeviceInfo} New device or the previously cached one
   */
  cacheDevice(device) {
    if (!this.devices.has(device.id)) {
      // This is a new device, keep track of it
      this.devices.set(device.id, device);
    }
    // Sanity, make sure that the device in the map is returned
    return this.devices.get(device.id);
  }

  createSocket() {
    this._socket = dgram.createSocket("udp4");

    // Bind the socket and when it is ready mark it for broadcasting
    this._socket.bind();
    this._socket.on("listening", () => {
      this._socket.setBroadcast(true);

      const address = this._socket.address();
      this.debug("Network bound to port", address.port);
    });

    // On any incoming message, parse it, update the discovery
    this._socket.on("message", (msg, rinfo) => {
      const buf = Buffer.from(msg);
      try {
        this.packet.raw = buf;
      } catch (ex) {
        this.debug("Could not handle incoming message");
        return;
      }

      if (!this.packet.deviceId) {
        this.debug("No device identifier in incoming packet");
        return;
      }

      const device = this.findDevice(this.packet.deviceId, rinfo);
      device.onMessage(buf);

      if (!this.packet.data) {
        if (!device.enriched) {
          // This is the first time we see this device
          device
            .enrich()
            .then(() => {
              this.emit("device", device);
            })
            .catch((err) => {
              this.emit("device", device);
            });
        } else {
          this.emit("device", device);
        }
      }
    });
  }

  list() {
    return this.devices.values();
  }

  /**
   * Get a reference to the network. Helps with locking of a socket.
   */
  ref() {
    this.debug("Grabbing reference to network");
    this.references++;
    this.updateSocket();

    let released = false;
    let self = this;
    return {
      release() {
        if (released) return;

        self.debug("Releasing reference to network");

        released = true;
        self.references--;

        self.updateSocket();
      },
    };
  }

  /**
   * Update wether the socket is available or not. Instead of always keeping
   * a socket we track if it is available to allow Node to exit if no
   * discovery or device is being used.
   */
  updateSocket() {
    if (this.references === 0) {
      // No more references, kill the socket
      if (this._socket) {
        this.debug("Network no longer active, destroying socket");
        this._socket.close();
        this._socket = null;
      }
    } else if (this.references === 1 && !this._socket) {
      // This is the first reference, create the socket
      this.debug("Making network active, creating socket");
      this.createSocket();
    }
  }

  get socket() {
    if (!this._socket) {
      throw new Error(
        "Network communication is unavailable, device might be destroyed"
      );
    }

    return this._socket;
  }
}

module.exports = new Network();
