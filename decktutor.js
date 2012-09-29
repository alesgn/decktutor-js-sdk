/**
 * decktutor.js
 *
 * Author: Giovanni Giacobbi <giovanni@giacobbi.net>
 * Copyright (c) 2012 DeckTutor
 *
 * @provides DeckTutor
 */

/**
 * Core library
 *
 * @class DeckTutor
 * @static
 */
var DeckTutor = {
  /**
   * The current active game
   *
   * @access private
   */
  _game: "mtg",

  /**
   * Endpoint for the webservice calls
   */
  endpoint: "http://dev.decktutor.com/ws-1.2/app/v1",

  /**
   * ...
   *
   * @access private
   * @param {string    message ...
   */
  _dbg: function(message) {
    console.log(message);
  },

  /**
   * Performs a request on the webservice
   *
   * @access private
   * @param {string}     method   ...
   * @param {string}     url      ...
   * @param {*}          data     ...
   * @param {function()} callback ...
   */
  _req: function(method, url, data, callback) {
    /* compose the final url */
    url = this.endpoint + url;

    /* postdata is used only in case the method is not GET */
    var postdata = null;
    if (method != "GET") {
      postdata = JSON.stringify(data);
    }
    else if (data != "") {
      /* append to the URL the data parameters */
      var str = [];
      for (var p in data) {
        if ((data[p] !== undefined) && (data[p] !== null) && (data[p] !== ""))
          str.push(encodeURIComponent(p) + "=" + encodeURIComponent(data[p]));
      }

      url += "?" + str.join("&");
    }

    /* initialize the server request */
    this._dbg("[req] " + method + " " + url);
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    // Send the proper header information along with the request
    //xhr.setRequestHeader("Content-Type", "application/json");
    //xhr.setRequestHeader("Content-length", postdata.length);
    //xhr.setRequestHeader("Connection", "close");

    if (this._auth_token !== undefined) {
      this._dbg(".. adding auth headers");

      /* calculate the signature for this request */
      var signature = $.md5(this._auth_sequence + ":" +
                            this._auth_secret);

      xhr.setRequestHeader("x-dt-Auth-Token", this._auth_token);
      xhr.setRequestHeader("x-dt-Sequence", this._auth_sequence);
      xhr.setRequestHeader("x-dt-Signature", signature);

      /* increment the sequence number for the next request */
      this._auth_sequence++;
    }
    else
      this._dbg(".. proceeding without authentication");

    // FIXME: missing all error handling
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4 && xhr.status == 200) {
        if (callback) {
          var response;

          try {
            response = (
              xhr.responseText != "" ?
                JSON.parse(xhr.responseText) : null);
          }
          catch (e) {
            // FIXME: throw an exception? or just let it pass?
            console.error("Failed to parse JSON response: " + e);
            return;
          }

          if (callback !== undefined)
            callback(response);

        }
      }
    };

    xhr.send(postdata);
  },


  /* ----------------------------------------------------------------------
   *  System core
   * ---------------------------------------------------------------------- */

  /**
   * Creates a new captcha for human validation
   *
   * @param {function(array)} callback ...
   */
  createCaptcha: function(callback) {
    this._req("POST", "/sys/createCaptha", null, function(response) {
      if (callback)
        callback(response);
    });
  },


  /* ----------------------------------------------------------------------
   *  Account module
   * ---------------------------------------------------------------------- */

  /**
   * Requests the authorization token
   *
   * This method basically logs in the instance
   *
   * @param {string}     login     ...
   * @param {string}     password  ...
   * @param {function()} callback  Callback to invoke after completion
   */
  login: function(login, password, callback) {
    var data = {
      "login": login,
      "password": password
    };
    var self = this;

    this._req("POST", "/account/login", data, function(response) {
      this._dbg("SUCCESS!");
      this._dbg(response);
      self._auth_token = response["auth_token"];
      self._auth_expiration = response["auth_token_expiration"];
      self._auth_secret = response["auth_token_secret"];
      self._auth_sequence = 1;

      if (callback)
        callback(response["user"]);
    });
  },

  /**
   * ...
   */
  logout: function(callback) {
    this._req("DELETE", "/account/login", null, function(response) {
      if (callback)
        callback();
    });
  },

  /**
   * Retrieves the nickname of the currently logged in user
   *
   * @return {string}   The login name, or null if not logged
   */
  getLogin: function(callback) {
    this._req("GET", "/account/login", null, function(response) {
      if (callback)
        callback(response);
    });
  },

  /**
   * Loads a configuration entry
   *
   * @param {string} key  Configuration key name to retrieve
   * @return {?}          The mixed ...
   */
  loadConfig: function(key, callback) {
    this._req("GET", "/account/config/" + key, null, function(response) {
      if (callback)
        callback(response);
    });
  },

  /**
   * Stores a configuration remotely
   *
   * @param {string} key    Configuration key to store the value
   * @param {*}      value  The configuration value to store
   */
  storeConfig: function(key, value) {
    if (value !== undefined) {
      this._req("PUT", "/account/config/" + key, value);
    }
    else {
      this._req("DELETE", "/account/config/" + key);
    }
  },

  /**
   * ...
   */
  register: function(privacy, user, person, address, prefs, captcha,
                     callback) {
    var data = {};
    data["user"] = user;
    data["person"] = person;
    data["address"] = address;
    data["prefs"] = prefs;
    data["privacy"] = privacy;

    if (captcha) {
      data["captcha_code"] = captcha[0];
      data["captcha_answer"] = captcha[1];
    }

    this._req("POST", "/account/register", data, function(response) {
      if (callback)
        callback();
    });
  },


  /* ----------------------------------------------------------------------
   *  Search module
   * ---------------------------------------------------------------------- */

  /**
   * Find card names
   *
   * @param {string} query   Search string to match for card names
   * @return {array}         ...
   */
  findCardNames: function(query, callback) {
    var params = {
      "game": this._game,
      "query": query
    };

    this._req("GET", "/search/card/name", params, function(response) {
      callback(response);
    });
  },

  /**
   * Finds card versions
   *
   * @param {string} name    Exact official name of the card to search
   * @param {string} set     Set code to limit the research or browse the set
   * @param {number} offset  Offset from which to return the results
   * @param {number} limit   Number of results to return
   * @param {string} order   Results ordering in the format column,dir
   * @param {function(array)} callback Callback to invoke for results
   */
  findCardVersions: function(name, set, offset, limit, order, callback) {
    var params = {
      "game": this._game,
      "name": name,
      "set": set,
      "offset": offset || 0,
      "limit": limit,
      "order": order
    };

    this._req("GET", "/search/card/version", params, function(response) {
      if (callback)
        callback(response);
    });
  },

  /**
   * ...
   *
   * @param {object} search   ...
   * @param {number} offset   ...
   * @param {number} limit    ...
   * @param {string} order    ...
   * @param {function(array)} ...
   */
  serp: function(search, offset, limit, order, callback) {
    var params = {
      "search": search,
      "offset": offset || 0,
      "limit": limit,
      "order": order
    };

    this._req("POST", "/search/serp", params, function(response) {
      if (callback)
        callback(response);
    });
  }
}

/**
 * Enum for the DeckTutor card games
 * @enum {string}
 */
DeckTutor.Games = {
  "mtg": "Magic the Gathering",
  "wow": "World of Warcraft",
  "ygo": "Yu-Gi-Oh!"
};

/**
 * ...
 * @enum {string}
 */
DeckTutor.CardStates = {
  "M": "Mint",
  "NM": "Near Mint",
  "EX": "Excellent",
  "VG": "Very Good",
  "GD": "Good",
  "PL": "Played",
  "PO": "Poor"
};

/**
 * ...
 * @enum {string}
 */
DeckTutor.CardLanguages = {
  "de": "German",
  "en": "English",
  "es": "Spanish",
  "fr": "French",
  "it": "Italian",
  "ja": "Japanese",
  "ko": "Korean",
  "pt": "Portuguese",
  "ru": "Russian",
  "zh": "Chinese Simplified",
  "zh-tw": "Chinese Traditional"
};
