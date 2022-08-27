"use strict";

module.exports = async function (fn, callback) {
  try {
    const result = await fn();
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};
