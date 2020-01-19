/* global chrome:false */


const EE = require('events').EventEmitter;
const util = require('util');

const SerialPort = function (path, options, openImmediately, callback) {
  EE.call(this);

  const self = this;
  self.port = {};

  const args = Array.prototype.slice.call(arguments);
  callback = args.pop();
  if (typeof (callback) !== 'function') {
    callback = null;
  }

  this.options = (typeof options !== 'function') && options || {};

  openImmediately = (openImmediately === undefined || openImmediately === null) ? true : openImmediately;

  callback = callback || function (err) {
    if (err) {
      if (self._events.error) {
        self.emit('error', err);
      } else {
        // factory doesnt exist atm
        // factory.emit('error', err);
      }
    }
  };

  chrome.runtime.sendMessage(SerialPortFactory.extensionId, { op: 'construct', path, options: this.options },
    (response) => {
      if (chrome.runtime.lastError) {
        return callback(chrome.runtime.lastError);
      }

      if (response && response.error) {
        return callback(new Error(response.error));
      }

      if (openImmediately) {
        process.nextTick(() => {
          self.open(callback);
        });
      }
    });
};
util.inherits(SerialPort, EE);

// always open immediately
SerialPort.prototype.open = function (callback) {
  if (!callback) { callback = function () {}; }

  const self = this;

  chrome.runtime.sendMessage(SerialPortFactory.extensionId, { op: 'open' },
    (response) => {
      if (chrome.runtime.lastError) {
        return callback(chrome.runtime.lastError);
      }

      if (response && response.error) {
        return callback(new Error(response.error));
      }

      self.port = chrome.runtime.connect(SerialPortFactory.extensionId);
      if (chrome.runtime.lastError) {
        // any other cleanup?
        return callback(chrome.runtime.lastError);
      }

      self.port.onDisconnect.addListener(() => {
        self.port = null;
      });

      const handleMessage = function (msg) {
        // console.log(msg, 'received');

        const cmds = {
          onDisconnect() {
            self.port.disconnect();
            // no way to know chrome port is disconnected?
            // can't just next tick so null here instead of waiting for ondisconnect
            self.port = null;
            self.emit('disconnect', msg.error);
          },
          onError() {
            self.emit('error', msg.error);
          },
          onClose() {
            self.port.disconnect();
            // no way to know chrome port is disconnected?
            // can't just next tick so null here instead of waiting for ondisconnect
            self.port = null;
            self.emit('close');
          },
          data() {
            if (msg && msg.hasOwnProperty('data') && msg.data.hasOwnProperty('data')) {
              self.emit('data', new Buffer(msg.data.data));
            }
          },
        };

        if (!cmds.hasOwnProperty(msg.op)) {
          console.log('unknown op');
        }

        cmds[msg.op]();
      };

      self.port.onMessage.addListener(handleMessage);
      self.emit('open');
      callback();
    });
};

SerialPort.prototype.write = function (data, callback) {
  if (!callback) { callback = function () {}; }

  // check if port is open somehow or chrome will just die
  if (!this.port) { return callback(new Error('Serialport not open')); }

  // node-serialport accepts strings or buffers
  // force a buffer so we know what we're dealing with on the other side
  // todo check for buffer and or error on other unknown types?
  if (typeof data === 'string') {
    this.port.postMessage(new Buffer(data));
  } else {
    this.port.postMessage(data);
  }


  callback(chrome.runtime.lastError);
};

SerialPort.prototype.flush = function (callback) {
  if (!callback) { callback = function () {}; }

  chrome.runtime.sendMessage(SerialPortFactory.extensionId, { op: 'flush' },
    (response) => {
      if (chrome.runtime.lastError) {
        return callback(chrome.runtime.lastError);
      }

      if (response && response.error) {
        return callback(new Error(response.error));
      }

      callback(null, response.data);
    });
};

SerialPort.prototype.drain = function (callback) {
  if (!callback) { callback = function () {}; }

  chrome.runtime.sendMessage(SerialPortFactory.extensionId, { op: 'drain' },
    (response) => {
      if (chrome.runtime.lastError) {
        return callback(chrome.runtime.lastError);
      }

      if (response && response.error) {
        return callback(new Error(response.error));
      }

      callback(null, response.data);
    });
};

SerialPort.prototype.close = function (callback) {
  if (!callback) { callback = function () {}; }

  chrome.runtime.sendMessage(SerialPortFactory.extensionId, { op: 'close' },
    (response) => {
      if (chrome.runtime.lastError) {
        return callback(chrome.runtime.lastError);
      }

      if (response && response.error) {
        return callback(new Error(response.error));
      }

      callback();
    });
};

const list = function (callback) {
  chrome.runtime.sendMessage(SerialPortFactory.extensionId, { op: 'list' },
    (response) => {
      if (chrome.runtime.lastError) {
        return callback(chrome.runtime.lastError);
      }

      if (response && response.error) {
        return callback(new Error(response.error));
      }

      callback(null, response.data);
    });
};

function isInstalled(callback) {
  if (typeof chrome.runtime === 'undefined') {
    return callback(new Error('chrome-serialport not installed'));
  }

  getManifest((err) => {
    if (err) {
      return callback(err);
    }

    callback();
  });
}

/*
input none
callback callback
*/
function getManifest(callback) {
  chrome.runtime.sendMessage(SerialPortFactory.extensionId, { op: 'getManifest' },
    (response) => {
      if (chrome.runtime.lastError) {
        return callback(chrome.runtime.lastError);
      }

      if (response && response.error) {
        return callback(new Error(response.error));
      }

      callback(null, response.data);
    });
}

var SerialPortFactory = {
  SerialPort,
  list,
  isInstalled,
};

module.exports = SerialPortFactory;