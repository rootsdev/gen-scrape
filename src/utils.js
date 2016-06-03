var debug = require('debug')('genscrape:utils');

var utils = {};

/**
 * Returns an array of strings with [0] being the given names and 
 * [1] being the family name. This function assumes that there is 
 * only one family name.
 */
utils.splitName = function(name) {
  if(typeof name === 'string' && name) {    
    return name.split(/\s+(?=\S*$)/);
  } else {
    return ['',''];
  }
};

/**
 * Takes in a simple url match pattern and returns a regex
 * for matching. Special chars are escaped except for * which
 * will have a . prepended to it.
 */
utils.urlPatternToRegex = function(pattern){
  pattern = pattern.replace(/\//g, '\/');
  pattern = pattern.replace(/\./g, '\.');
  pattern = pattern.replace(/\-/g, '\-');
  pattern = pattern.replace(/\*/g, '.*');
  return new RegExp(pattern);
};

/**
 * Returns the hash values as a map {key:value}
 */
utils.getHashParts = function() {
  var hashParts = {};
  if( window.location.hash ) {
    window.location.hash.substring(1).split('&').forEach(function(part) {
      var partPieces = part.split('=');
      hashParts[partPieces[0]] = partPieces[1];
    });
  }
  return hashParts;
};

/**
 * Return query params as a map
 */
utils.getQueryParams = function(){
  var paramArray = window.location.search.substr(1).split("&");
  var params = {};

  for ( var i = 0; i < paramArray.length; i++) {
    if(paramArray[i]){
      var tempArray = paramArray[i].split("=");
      params[tempArray[0]] = tempArray[1];
    }
  }
  
  return params;
};

/**
 * Return an empty object if passed in a null or undefined
 */
utils.maybe = function(value) {
  return value != null ? value : {}; // != null also covers undefined
};

/**
 * Capitalizes a string according to title case (first letter of each word)
 */
utils.toTitleCase = function(str){
  return str.replace(/\w\S*/g, function(txt){
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

/**
 * Simple JSON AJAX without jQuery
 * http://youmightnotneedjquery.com/#json
 * 
 * @param {String} url
 * @param {Function} callback - function(error, data)
 */
utils.getJSON = function(url, callback){
  debug('getJSON: ' + url);
  var request = new window.XMLHttpRequest();
  request.open('GET', url);
  request.onload = function() {
    if (request.status >= 200 && request.status < 400) {
      callback(undefined, JSON.parse(request.responseText));
    } else {
      callback(new Error(request.statusText));
    }
  };
  request.onerror = function() {
    callback(new Error(request.statusText));
  };
  request.send();
};

module.exports = utils;