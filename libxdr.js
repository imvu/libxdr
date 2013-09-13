/* libxdr: Cross-browser cross-domain request library
@version 0.0.1
@requires pmxdr client library, http://code.eligrey.com/pmxdr/client/
@archive http://code.eligrey.com/pmxdr/libxdr/
@desc Implements XDR cross-domain request constructor using the pmxdr client library
@license X11/MIT
@author Eli Grey, http://eligrey.com
*/

/*! @source http://purl.eligrey.com/github/libxdr/blob/master/libxdr.js*/

module({}, function (imports) {
  function delegate(object, method, args) {
    return object[method].apply(object, args);
  }

  function XMLHttpRequestFactory(options) {
    var XMLHttpRequest = IMVU.requireProperty(options, 'XMLHttpRequest');
    var location = IMVU.requireProperty(options, 'location');
    var pmxdr = IMVU.requireProperty(options, 'pmxdr');

    var hasNativeCrossOriginSupport = false;
    try {
      hasNativeCrossOriginSupport = (
        'withCredentials' in XMLHttpRequest.prototype ||
        'withCredentials' in (new XMLHttpRequest())
      );
    } catch (e) {}

    if (hasNativeCrossOriginSupport) {
        return XMLHttpRequest;
    }

    function XDR() { // TODO: support { anon: true }
      // Privates for delegation
      this.__isCrossOrigin = false;
      this.__origin = {
        scheme: location.protocol.substring(0, location.protocol.length - 1),
        authority: location.host
      };
      this._xhrDelegate = null;

      // Request parameters
      this.readyState = 0;
      this.withCredentials = false;
      this.timeout = 0;
      // TODO: support .upload

      // Response parameters
      this.status = 0;
      this.statusText = '';
      this.response = '';
      this.responseText = '';
      this.responseType = '';
      this.responseXML = null;
    }

    //XDR.defaultTimeout = 10000; // default timeout; 10000 is IE8's default for similar XDomainRequest
    XDR.UNSENT = 0;
    XDR.OPENED = 1;
    XDR.HEADERS_RECEIVED = 2;
    XDR.LOADING = 3;
    XDR.DONE = 4;

    XDR.prototype = {
      UNSENT: 0,
      OPENED: 1,
      HEADERS_RECEIVED: 2,
      LOADING: 3,
      DONE: 4,
      open: function (method, uri, async) { // TODO: support user, password
        var parsedUri = new IMVU.URI(uri);
        var scheme = parsedUri.getScheme();
        var authority = parsedUri.getAuthority();
        this.__isCrossOrigin = !(
           (scheme === null || scheme === this.__origin.scheme) &&
           (authority === null || authority === this.__origin.authority)
        );
        if (!this.__isCrossOrigin) {
          this._xhrDelegate = new XMLHttpRequest();
          this._xhrDelegate.onloadstart = function () { return delegate(this, 'onloadstart', arguments); }.bind(this);
          this._xhrDelegate.onprogress  = function () { return delegate(this, 'onprogress', arguments);  }.bind(this);
          this._xhrDelegate.onabort     = function () { return delegate(this, 'onabort', arguments);     }.bind(this);
          this._xhrDelegate.onerror     = function () { return delegate(this, 'onerror', arguments);     }.bind(this);
          this._xhrDelegate.onload      = function () { return delegate(this, 'onload', arguments);      }.bind(this);
          this._xhrDelegate.ontimeout   = function () { return delegate(this, 'ontimeout', arguments);   }.bind(this);
          this._xhrDelegate.onloadend   = function () { return delegate(this, 'onloadend', arguments);   }.bind(this);
          this._xhrDelegate.onreadystatechange = function () {
            this.readyState = this._xhrDelegate.readyState;
            this.response = this._xhrDelegate.response;
            this.responseText = this._xhrDelegate.responseText;
            return delegate(this, 'onreadystatechange', arguments);
          }.bind(this);
          this._xhrDelegate.open(method, uri, async);
          return;
        }

        if (async === false)
          throw new RangeError("XDR.open: libxdr does not support synchronous requests.");

        this._request = { // request object for pmxdr.request
          method : method,
          uri    : uri,
          headers: {}
        };
      },

      getResponseHeader: function () {
        if (this._xhrDelegate) {
          return delegate(this._xhrDelegate, 'getResponseHeader', arguments);
        }
        throw new Error('Assertion failure: getResponseHeader() not replaced by cross-origin xdr .send()');
      },

      getAllResponseHeaders: function () {
        if (this._xhrDelegate) {
          return delegate(this._xhrDelegate, 'getAllResponseHeaders', arguments);
        }
        throw new Error('Assertion failure: getAllResponseHeaders() not replaced by cross-origin xdr .send()');
      },

      setRequestHeader: function(header, value) {
        if (this._xhrDelegate) {
          return delegate(this._xhrDelegate, 'setRequestHeader', arguments);
        }
        this._request.headers[header.toLowerCase()] = value;
      },

      removeRequestHeader: function(header) { // TODO: remove; this isn't in the spec
        delete this._request.headers[header.toLowerCase()];
      },

      send: function (data) {
        if (this._xhrDelegate) {
          this._xhrDelegate.timeout = this.timeout;
          this._xhrDelegate.withCredentials = this.withCredentials;
          return delegate(this._xhrDelegate, 'send', arguments);
        }
        var instance = this; // for minification & reference to this
        instance._request.data = data;
        instance._request.callback = function(response) {
          instance.readyState = 4; // for onreadystatechange

          if (response.error) {
            if (response.error === "LOAD_ERROR") {
              instance.status = 502; // 502 Bad Gateway (seems reasonable when response.status is not set)
              instance.statusText = "Bad Gateway";
            }

            else if (response.error === "DISALLOWED_REQUEST_METHOD") {
              instance.status = 405; // 405 Method Not Allowed
              instance.statusText = "Method Not Allowed";
            }

            else if (response.error === "TIMEOUT") {
              instance.status = 408; // 408 Request Timeout
              instance.statusText = "Request Timeout";
            }

            else if (response.error === "DISALLOWED_ORIGIN") {
              instance.status = 412; // 412 Precondition Failed (seems right for disallowed origin)
              instance.statusText = "Precondition Failed";
            }
          } else {
            if (response.status)
              instance.status = response.status;
            if (response.statusText)
              instance.statusText = response.statusText;
          }

            if (!instance.status)
              instance.status = 200; // pmxdr host wouldn't respond unless the status was 200 so default to it


          if (response.error || instance.status >= 400) {
            if (typeof instance.onloadend === "function")
              instance.onloadend();
            if (typeof instance.onerror === "function")
              return instance.onerror();
          }

          if (instance.status === 408 && typeof instance.ontimeout === "function")
              return instance.ontimeout();

          instance.responseXML = null; // TODO: support responseXML iff responseType === 'xml'

          instance.responseText = response.data;

          if (!response.headers) {
            response.headers = {};
          }

          instance.contentType = response.headers["content-type"];

          var headers = [];
          for (var header in response.headers) // recreate the getAllResponseHeaders string
            if (response.headers.hasOwnProperty(header))
              headers.push(header + ": " + response.headers[header]);

          headers = headers.join("\r\n");
          instance.getAllResponseHeaders = function() {
            return headers;
          };

          instance.getResponseHeader = function(header) {
            return response.headers[header.toLowerCase()] || null;
          };

          if (typeof instance.onreadystatechange === "function")
            instance.onreadystatechange();
          if (typeof instance.onprogress === "function")
            instance.onprogress();
          if (typeof instance.onload === "function")
            instance.onload();
          if (typeof instance.onloadend === "function")
            instance.onloadend();

        };

        if (instance.timeout) instance._request.timeout = instance.timeout;
        else if (XDR.defaultTimeout) instance._request.timeout = XDR.defaultTimeout;

        // do the request and get the abort method
        var aborter = pmxdr.request(instance._request).abort;

        instance.abort = function() {
          aborter();
        };
      },

      abort: function() { // default abort
        if (this._xhrDelegate) {
          return delegate(this, 'abort', arguments);
        }
        delete this._request;
      },

      onloadstart: function () {},
      onprogress: function () {},
      onabort: function () {},
      onerror: function () {},
      onload: function () {},
      ontimeout: function () {},
      onloadend: function () {},
      onreadystatechange: function () {}
    };
    return XDR;
  }
  return XMLHttpRequestFactory;
});
