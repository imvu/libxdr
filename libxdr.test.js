/*jshint es5: true*/
module({
    XMLHttpRequestFactory: 'libxdr.js',
    FakeXMLHttpRequestFactory: '../../fakes/FakeXMLHttpRequestFactory.js'
}, function (imports) {
    function FakePmxdr() {
        this._instances = [];
    }
    FakePmxdr.prototype.request = function (options) {
        var instance = {
            _abortCalls: 0,
            _options: options,
            abort: function () {
                this._abortCalls += 1;
            }
        };
        this._instances.push(instance);
        return instance;
    };

    test('has XMLHttpRequest constants', function () {
        this.xmlHttpRequestFactory = new imports.XMLHttpRequestFactory({
            XMLHttpRequest: function () {},
            location: {
                protocol: 'http:',
                host: 'hostname:1234'
            },
            pmxdr: new FakePmxdr()
        });

        var xhr = new this.xmlHttpRequestFactory();
        assert.equal(0, xhr.UNSENT);
        assert.equal(1, xhr.OPENED);
        assert.equal(2, xhr.HEADERS_RECEIVED);
        assert.equal(3, xhr.LOADING);
        assert.equal(4, xhr.DONE);

        assert.equal(0, this.xmlHttpRequestFactory.UNSENT);
        assert.equal(1, this.xmlHttpRequestFactory.OPENED);
        assert.equal(2, this.xmlHttpRequestFactory.HEADERS_RECEIVED);
        assert.equal(3, this.xmlHttpRequestFactory.LOADING);
        assert.equal(4, this.xmlHttpRequestFactory.DONE);
    });

    fixture('libxdr (CORS XMLHttpRequest)', function () {
        this.setUp(function () {
            this.XMLHttpRequest = new imports.FakeXMLHttpRequestFactory();
            this.pmxdr = new FakePmxdr();

            this.xmlHttpRequestFactory = new imports.XMLHttpRequestFactory({
                XMLHttpRequest: this.XMLHttpRequest,
                location: {
                    protocol: 'http:',
                    host: 'origin-one'
                },
                pmxdr: this.pmxdr
            });
        });

        this.tearDown(function () {
            assert.equal(0, this.XMLHttpRequest._getAllPending().length);
            assert.true(this.XMLHttpRequest._areAllResolved());
        });


        test('delegates to provided xmlhttprequest if it is cors-enabled', function () {
            var xhr = new this.xmlHttpRequestFactory();
            var done = false;
            xhr.onreadystatechange = function () {
                if (xhr.readyState === xhr.DONE) {
                    done = true;
                }
            };
            xhr.open('GET', 'http://origin-two/bar');
            xhr.send();
            this.XMLHttpRequest._respond('GET', 'http://origin-two/bar', 200, {}, 'herp');
            assert.true(done);
            assert.equal('herp', xhr.responseText);
        });
    });

    fixture('libxdr (non-CORS XMLHttpRequest)', function () {
        this.setUp(function () {
            this.pmxdr = new FakePmxdr();

            this.xhrInstances = [];
            var self = this;
            this.BadXMLHttpRequest = function () {
                self.xhrInstances.push(this);
                this._trace = [];
                ['open', 'abort', 'send', 'setRequestHeader'].forEach(function (name) {
                    this[name] = function () {
                        this._trace.push({
                            name: name,
                            args: arguments
                        });
                    }.bind(this);
                }.bind(this));
            };

            this.XDR = new imports.XMLHttpRequestFactory({
                XMLHttpRequest: this.BadXMLHttpRequest,
                location: {
                    protocol: 'http:',
                    host: 'hostname:8080'
                },
                pmxdr: this.pmxdr
            });

            assert.equal(1, this.xhrInstances.length); // must instantiate an XHR instance to determine cors support
            this.xhrInstances = [];
        });

        test('calls pmxdr when cross-origin', function () {
            var xhr = new this.XDR();
            var done = false;
            xhr.onreadystatechange = function () {
                if (xhr.readyState === xhr.DONE) {
                    done = true;
                }
            };
            xhr.open('GET', 'http://alternative/bar');
            xhr.setRequestHeader('Herp', 'Derp');
            xhr.send();

            assert.equal(1, this.pmxdr._instances.length);
            assert.equal('GET', this.pmxdr._instances[0]._options.method);
            assert.equal('http://alternative/bar', this.pmxdr._instances[0]._options.uri);
            assert.equal('Derp', this.pmxdr._instances[0]._options.headers.herp);
            assert.false(done);

            this.pmxdr._instances[0]._options.callback({
                status: 200,
                statusText: 'OK',
                data: 'the response',
                headers: {
                    herpy: 'derpy',
                    hoopy: 'doopy',
                }
            });

            assert.true(done);
            assert.equal(200, xhr.status);
            assert.equal('OK', xhr.statusText);
            assert.equal('the response', xhr.responseText);
            assert.equal('derpy', xhr.getResponseHeader('herpy'));
            assert.equal('doopy', xhr.getResponseHeader('hoopy'));
            assert.equal('herpy: derpy\r\nhoopy: doopy', xhr.getAllResponseHeaders());

            assert.equal(0, this.xhrInstances.length);
        });

        this.assertDelegatesToXMLHttpRequest = function (url) {
            var xhr = new this.XDR();
            var events = {};
            xhr.onloadstart        = function () { events.onloadstart = true; };
            xhr.onprogress         = function () { events.onprogress = true; };
            xhr.onabort            = function () { events.onabort = true; };
            xhr.onerror            = function () { events.onerror = true; };
            xhr.onload             = function () { events.onload = true; };
            xhr.ontimeout          = function () { events.ontimeout = true; };
            xhr.onloadend          = function () { events.onloadend = true; };
            xhr.onreadystatechange = function () { events.onreadystatechange = true; };
            xhr.open('POST', url);
            xhr.withCredentials = true;
            xhr.timeout = 12345;
            xhr.setRequestHeader('Herp', 'Derp');
            xhr.send('body');

            assert.equal(1, this.xhrInstances.length);
            assert.equal('open', this.xhrInstances[0]._trace[0].name);
            assert.equal('POST', this.xhrInstances[0]._trace[0].args[0]);
            assert.equal(url, this.xhrInstances[0]._trace[0].args[1]);

            assert.equal('setRequestHeader', this.xhrInstances[0]._trace[1].name);
            assert.equal('Herp', this.xhrInstances[0]._trace[1].args[0]);
            assert.equal('Derp', this.xhrInstances[0]._trace[1].args[1]);

            assert.equal('send', this.xhrInstances[0]._trace[2].name);
            assert.equal('body', this.xhrInstances[0]._trace[2].args[0]);

            assert.equal(true, this.xhrInstances[0].withCredentials);
            assert.equal(12345, this.xhrInstances[0].timeout);

            assert.deepEqual({}, events);

            this.xhrInstances[0].onloadstart();
            this.xhrInstances[0].onprogress();
            this.xhrInstances[0].onabort();
            this.xhrInstances[0].onerror();
            this.xhrInstances[0].onload();
            this.xhrInstances[0].ontimeout();
            this.xhrInstances[0].onloadend();
            this.xhrInstances[0].onreadystatechange();

            assert.deepEqual({
                onloadstart: true,
                onprogress: true,
                onabort: true,
                onerror: true,
                onload: true,
                ontimeout: true,
                onloadend: true,
                onreadystatechange: true,
            }, events);
        };

        test('delegates to xmlhttprequest when relative', function () {
            this.assertDelegatesToXMLHttpRequest('/relative/url');
        });

        test('delegates to xmlhttprequest when scheme-relative', function () {
            this.assertDelegatesToXMLHttpRequest('//hostname:8080/scheme-relative/url');
        });

        test('delegates to xmlhttprequest when same origin absolute', function () {
            this.assertDelegatesToXMLHttpRequest('http://hostname:8080/scheme-relative/url');
        });
    });
});
