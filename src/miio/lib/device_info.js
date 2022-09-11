"use strict";

const debug = require("debug");
const Packet = require("./packet");
const safeishJSON = require("./safeishJSON");

const ERRORS = {
  "-5001": (method, args, err) =>
    err.message === "invalid_arg" ? "Invalid argument" : err.message,
  "-5005": (method, args, err) =>
    err.message === "params error" ? "Invalid argument" : err.message,
  "-10000": (method) => "Method `" + method + "` is not supported",
};

class DeviceInfo {
  constructor(parent, id, address, port) {
    this.parent = parent;
    this.packet = new Packet();

    this.address = address;
    this.port = port;

    // Tracker for all promises associated with this device
    this.promises = new Map();
    this.lastId = 0;

    this.id = id;
    this.debug = id ? debug("thing:miio:" + id) : debug("thing:miio:pending");

    // Get if the token has been manually changed
    this.tokenChanged = false;
  }

  get token() {
    return this.packet.token;
  }

  set token(t) {
    this.debug("Using manual token:", t.toString("hex"));
    this.packet.token = t;
    this.tokenChanged = true;
  }

  /**
   * Enrich this device with detailed information about the model. This will
   * simply call miIO.info.
   */
  async enrich() {
    if (!this.id) {
      throw new Error("Device has no identifier yet, handshake needed");
    }

    if (this.model && !this.tokenChanged && this.packet.token) {
      // This device has model info and a valid token
      return Promise.resolve();
    }

    if (this.packet.token) {
      if (this.tokenChanged) {
        this.autoToken = false;
      } else {
        this.autoToken = true;
        this.debug("Using automatic token:", this.packet.token.toString("hex"));
      }
    }

    if (!this.enrichPromise) {
      this.enrichPromise = this.call("miIO.info");
    }

    try {
      const { model } = await this.enrichPromise;
      this.model = model;
      this.tokenChanged = false;
    } catch (err) {
      if (err.code === "missing-token") {
        err.device = this;
        throw err;
      } else if (this.packet.token) {
        // Could not call the info method, this might be either a timeout or a token problem
        const e = new Error(
          "Could not connect to device, token might be wrong"
        );
        e.code = "connection-failure";
        e.device = this;
        throw e;
      } else {
        const e = new Error(
          "Could not connect to device, token needs to be specified"
        );
        e.code = "missing-token";
        e.device = this;
        throw e;
      }
    } finally {
      this.enriched = true;
      this.enrichPromise = null;
    }
  }

  onMessage(msg) {
    try {
      this.packet.raw = msg;
    } catch (ex) {
      this.debug("<- Unable to parse packet", ex);
      return;
    }

    let data = this.packet.data;
    if (data === null) {
      this.debug("<-", "Handshake reply:", this.packet.checksum);
      this.packet.handleHandshakeReply();

      if (this.handshakeResolve) {
        this.handshakeResolve();
      }
    } else {
      // Handle null-terminated strings
      if (data[data.length - 1] === 0) {
        data = data.slice(0, data.length - 1);
      }

      // Parse and handle the JSON message
      let str = data.toString("utf8");

      // Remove non-printable characters to help with invalid JSON from devices
      str = str.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, "");

      this.debug("<- Message: `" + str + "`");
      try {
        let object = safeishJSON(str);

        const p = this.promises.get(object.id);
        if (!p) return;
        if (typeof object.result !== "undefined") {
          p.resolve(object.result);
        } else {
          p.reject(object.error);
        }
      } catch (ex) {
        this.debug("<- Invalid JSON", ex);
      }
    }
  }

  async handshake() {
    if (!this.packet.needsHandshake) {
      return Promise.resolve(this.token);
    }

    // If a handshake is already in progress use it
    if (!this.handshakePromise) {
      this.handshakePromise = this._sendHandshakePackage();
    }

    try {
      return await Promise.race([this.handshakePromise, this._setTimeout()]);
    } catch (err) {
      if (err.code === "timeout") {
        this.debug("<- Handshake timed out");
      }
      throw err;
    } finally {
      this.handshakeResolve = null;
      this.handshakePromise = null;
    }
  }

  async _sendHandshakePackage() {
    const waitForResponse = this._waitForHandshakeResponse();
    // Create and send the handshake data
    this.packet.handshake();
    await this._sendPacket();
    return await waitForResponse;
  }

  async _sendPacket() {
    return await new Promise((resolve, reject) => {
      const data = this.packet.raw;
      this.parent.socket.send(
        data,
        0,
        data.length,
        this.port,
        this.address,
        (err) => (err ? reject(err) : resolve())
      );
    });
  }

  async _waitForHandshakeResponse() {
    return await new Promise((resolve, reject) => {
      // Handler called when a reply to the handshake is received
      this.handshakeResolve = () => {
        if (this.id !== this.packet.deviceId) {
          // Update the identifier if needed
          this.id = this.packet.deviceId;
          this.debug = debug("thing:miio:" + this.id);
          this.debug("Identifier of device updated");
        }

        if (this.packet.token) {
          resolve(this.token);
        } else {
          const err = new Error(
            "Could not connect to device, token needs to be specified"
          );
          err.code = "missing-token";
          reject(err);
        }
      };
    });
  }

  async _setTimeout() {
    await new Promise((resolve, reject) =>
      setTimeout(() => {
        const err = new Error("Could not connect to device, handshake timeout");
        err.code = "timeout";
        reject(err);
      }, 2000)
    );
  }

  async call(method, params = [], options = {}) {
    const { retries = 5 } = options;
    return await this._retryOnTimeout(retries, async (retriesLeft) => {
      await this.handshake(); // Ensure the handshake is done

      const request = {
        id: this._nextId(retries === retriesLeft), // Assign the identifier
        method,
        params,
        sid: options.sid, // If we have a sub-device set it (used by Lumi Smart Home Gateway)
      };

      try {
        // Enqueue promise listener to this request ID
        const waitForResponse = this._waitForResponse(request.id);

        // Create the JSON and send it
        const json = JSON.stringify(request);
        this.debug("-> (" + retriesLeft + ")", json);
        this.packet.data = Buffer.from(json, "utf8");
        await this._sendPacket();
        return await waitForResponse;
      } catch (err) {
        if (!(err instanceof Error) && typeof err.code !== "undefined") {
          const code = err.code;
          const handler = ERRORS[code];
          const msg = handler
            ? handler(method, params, err)
            : err.message || err.toString();

          err = new Error(msg);
          err.code = code;
        }
        throw err;
      } finally {
        this.promises.delete(request.id);
      }
    });
  }

  async _waitForResponse(requestId) {
    return new Promise((resolve, reject) => {
      // Store reference to the promise so reply can be received
      this.promises.set(requestId, { resolve, reject });
    });
  }

  /**
   * Retries the action defined in `actionPromiseFn` as many times as `retries`,
   * only if the action fails due to a timeout.
   * @param retries Max number of attempts
   * @param actionPromiseFn Method that returns a promise to repeat
   * @private
   */
  async _retryOnTimeout(retries = 5, actionPromiseFn) {
    while (retries > 0) {
      try {
        const result = await Promise.race([
          actionPromiseFn(retries),
          this._setTimeout(),
        ]);
        return result;
      } catch (err) {
        if (err.code !== "timeout") {
          throw err;
        }
        retries--;
      }
    }
    this.debug("Reached maximum number of retries, giving up");
    const maxRetriesError = new Error("Call to device timed out");
    maxRetriesError.code = "timeout";
    throw maxRetriesError;
  }

  _nextId(isFirstAttempt) {
    let id;

    if (isFirstAttempt) {
      id = this.lastId + 1;
    } else {
      /*
       * This is a failure, increase the last id. Should
       * increase the chances of the new request to
       * succeed. Related to issues with the vacuum
       * not responding such as described in issue
       * https://github.com/aholstenson/miio/issues/94.
       */
      id = this.lastId + 100;
    }

    // Check that the id hasn't rolled over
    if (id >= 10000) {
      this.lastId = id = 1;
    } else {
      this.lastId = id;
    }

    return id;
  }
}

module.exports = DeviceInfo;
