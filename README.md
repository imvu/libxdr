This is a fork of Eli Grey's [libxdr][libxdr]. It depends on [pmxdr][pmxdr],
which is also a fork of Eli Grey's [pmxdr][eli-pmxdr] and [imvujs][imvujs].

This fork of libxdr provides a factory for an
[XMLHttpRequest][xmlhttprequest]-compatible interface, which falls back to the
browser's native XMLHttpRequest if your browser supports cross-origin requests
or if the request you make is not a cross-origin request.

This means you can use XMLHttpRequest in IE8 and IE9 as if it supported [CORS][CORS].

The wrapper around XMLHttpRequest does not support the following features in [XMLHttpRequest][xmlhttprequest]:

* `{ anon: true }` in constructor
* user, password arguments in `.open()`
* `.open()`'s async argument must not be false
* correct state changes: never gets to `HEADERS_RECEIVED` or `LOADING`
* property setter state assertions
* `.upload` property
* `.responseType` property
* `.response` property


[imvujs]: http://github.com/imvu/imvujs
[libxdr]: http://github.com/eligrey/libxdr
[eli-pmxdr]: http://github.com/eligrey/pmxdr
[pmxdr]: http://github.com/srhazi-imvu/pmxdr
[xmlhttprequest]: http://www.w3.org/TR/XMLHttpRequest/
[cors]: http://www.w3.org/TR/cors/
