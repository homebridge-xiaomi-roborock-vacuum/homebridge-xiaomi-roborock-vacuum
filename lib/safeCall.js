'use strict';

/**
 * Calls the function `fn` if `maybeValue` is not undefined
 * 
 * @param maybeValue The value that can be undefined
 * @param fn The function to be called with the value as a parameter
 */
module.exports = async function (maybeValue, fn) {
  if (typeof maybeValue !== 'undefined') {
    return fn(maybeValue);
  }
}