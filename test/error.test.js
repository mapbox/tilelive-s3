var tape = require('tape');
var S3 = require('..');
var http = require('http');
var path = require('path');
var fs = require('fs');
var fixtures = path.resolve(__dirname + '/fixtures');
var AWS = require('aws-sdk');

function error(code, message) {
    message = message || 'unknown error';
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<Error>\n' +
        '  <Code>' + code + '</Code>\n' +
        '  <Message>' + message + '</Message>\n' +
        '</Error>';
}

var attempts = 0;
var png = fs.readFileSync(fixtures + '/tile.png');

var mock = http.createServer(function (req, res) {
    attempts++;
    var routes = {
        invalid: /^\/invalid(get|put)(\/\d){3}.png$/,
        slow: /^\/slow(get|put)(\/\d){3}.png$/,
        missing: /^\/missingget(\/\d){3}.png$/,
        hangup: /^\/hangup(get|put)(\/\d){3}.png$/,
        rate: /^\/rate(get|put)(\/\d){3}.png$/,
        internal: /^\/internal(get|put)(\/\d){3}.png$/,
        nobody: /^\/nobody(get|put)(\/\d){3}.png$/,
        length: /^\/lengthget(\/\d){3}.png$/
    };

    res.setHeader('x-amz-request-id', '0000000000000000');
    res.setHeader('x-amz-id-2', '01234567');

    if (routes.slow.test(req.url)) {
        return setTimeout(function() {
            res.writeHead(200);
            res.end();
        }, req.method.toLowerCase() === req.url.match(routes.slow)[1] ? 5500 : 10);
    }

    if (routes.missing.test(req.url)) {
        res.writeHead(req.method === 'GET' ? 404 : 200);
        return res.end();
    }

    if (routes.hangup.test(req.url)) {
        if (req.method.toLowerCase() === req.url.match(routes.hangup)[1])
            return req.socket.destroy();

        res.writeHead(200);
        return res.end();
    }

    if (routes.invalid.test(req.url)) {
        if (req.method.toLowerCase() === req.url.match(routes.invalid)[1]) {
            res.writeHead(400);
            return res.end(error('InvalidBucketName', 'The specified bucket is not valid'));
        }

        res.writeHead(200);
        return res.end();
    }

    if (routes.rate.test(req.url)) {
        if (req.method.toLowerCase() === req.url.match(routes.rate)[1]) {
            res.writeHead(503);
            return res.end(error('SlowDown', 'Reduce your request rate'));
        }

        res.writeHead(200);
        return res.end();
    }

    if (routes.internal.test(req.url)) {
        if (req.method.toLowerCase() === req.url.match(routes.internal)[1]) {
            res.writeHead(500);
            return res.end(error('InternalError'));
        }

        res.writeHead(200);
        return res.end();
    }

    if (routes.nobody.test(req.url)) {
        if (req.method.toLowerCase() === req.url.match(routes.nobody)[1]) {
            res.writeHead(503);
            return res.end();
        }

        res.writeHead(200);
        return res.end();
    }

    if (routes.length.test(req.url)) {
        res.writeHead(200, { 'Content-Length': 100 });
        res.end('Not 100 characters');
        return req.socket.destroy();
    };

    res.writeHead(404);
    res.end();
});

function test(msg, assertions) {
    tape(msg, function(assert) {
        S3.agent = http.globalAgent;
        AWS.config.update({
            endpoint: new AWS.Endpoint('http://localhost:20009'),
            s3BucketEndpoint: true
        });

        mock.listen(20009, function(err) {
            if (err) throw err;

            var done = assert.end.bind(assert);
            assert.end = function(err) {
                mock.close(function(error) {
                    if (error) throw error;
                    attempts = 0;
                    done(err);
                });
            };

            assertions(assert);
        });
    });
}

test('getTile retry timeout', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/slowget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.getTile(3, 6, 5, function(err) {
                assert.equal(err.message, 'Timed out after 5000ms', 'expected message');
                assert.equal(err.statusCode, 504, 'expected statusCode');
                assert.equal(attempts, 5, 'retried 4 times');
                assert.end();
            });
        });
    });
});

test('putTile success on GET timeout', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/slowget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.ifError(err, 'successful put');
                assert.equal(attempts, 6, 'retried GET 5 times + put attempt');
                assert.end();
            });
        });
    });
});

test('putTile retry on PUT timeout', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/slowput/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.equal(err.message, 'Timed out after 5000ms', 'expected message');
                assert.equal(err.statusCode, 504, 'expected statusCode');
                assert.equal(attempts, 6, '1 GET and retried PUT 4 times');
                assert.end();
            });
        });
    });
});

test('getTile do not retry missing', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/missingget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.getTile(3, 6, 5, function(err) {
                assert.equal(err.statusCode, 404, 'expected statusCode');
                assert.equal(attempts, 1, 'did not retry');
                assert.end();
            });
        });
    });
});

test('putTile do not retry GET missing', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/missingget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.ifError(err, 'successful put');
                assert.equal(attempts, 2, 'Did not retry GET');
                assert.end();
            });
        });
    });
});

test('getTile retry hangups', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/hangupget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.getTile(3, 6, 5, function(err) {
                assert.equal(err.message, 'socket hang up', 'expected message');
                assert.equal(err.statusCode, 500, 'expected statusCode');
                assert.equal(attempts, 5, 'retried 4 times');
                assert.end();
            });
        });
    });
});

test('putTile retry on GET hangup', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/hangupget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.ifError(err, 'successful put');
                assert.equal(attempts, 6, 'retried GET 5 times + put attempt');
                assert.end();
            });
        });
    });
});

test('putTile retry on PUT hangup', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/hangupput/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.equal(err.message, 'socket hang up', 'expected message');
                assert.equal(err.statusCode, 500, 'expected statusCode');
                assert.equal(attempts, 6, 'retried PUT 4 times');
                assert.end();
            });
        });
    });
});

test('getTile do not retry unmanaged http error', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/invalidget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.getTile(3, 6, 5, function(err) {
                assert.equal(err.message, 'The specified bucket is not valid', 'expected message');
                assert.equal(attempts, 1, 'did not retry');
                assert.end();
            });
        });
    });
});

test('putTile ignores GET unmanaged http error', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/invalidget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.ifError(err, 'successful put');
                assert.equal(attempts, 2, 'no retries, 1 put attempt');
                assert.end();
            });
        });
    });
});

test('putTile fails on PUT unmanaged http error', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/invalidput/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.equal(err.message, 'The specified bucket is not valid', 'expected message');
                assert.equal(err.statusCode, 400, 'expected statusCode');
                assert.equal(attempts, 2, 'no retries');
                assert.end();
            });
        });
    });
});

test('getTile retry internal error', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/internalget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.getTile(3, 6, 5, function(err) {
                assert.equal(err.message, '[x-amz-id-2:01234567] [x-amz-request-id:0000000000000000] unknown error', 'expected message');
                assert.equal(err.statusCode, 500, 'expected statusCode');
                assert.equal(attempts, 5, 'retried 4 times');
                assert.end();
            });
        });
    });
});

test('putTile ignores GET internal error', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/internalget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.ifError(err, 'successful put');
                assert.equal(attempts, 6, 'retried GET 5 times + put attempt');
                assert.end();
            });
        });
    });
});

test('putTile retry on PUT internal error', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/internalput/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.equal(err.message, '[x-amz-id-2:01234567] [x-amz-request-id:0000000000000000] unknown error', 'expected message');
                assert.equal(err.statusCode, 500, 'expected statusCode');
                assert.equal(attempts, 6, 'retried PUT 4 times');
                assert.end();
            });
        });
    });
});

test('putTile no retry on PUT http error (no body)', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/nobodyput/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);
        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.equal(err.message, '[x-amz-id-2:01234567] [x-amz-request-id:0000000000000000] 503 Unknown');
                assert.equal(err.statusCode, 503, 'expected statusCode');
                assert.equal(attempts, 6, 'retried PUT 4 times');
                assert.end();
            });
        });
    });
});

test('getTile error with no body', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/nobodyget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.getTile(3, 6, 5, function(err) {
                assert.equal(err.message, '[x-amz-id-2:01234567] [x-amz-request-id:0000000000000000] 503 Unknown', 'expected message');
                assert.equal(err.statusCode, 503, 'expected statusCode');
                assert.equal(attempts, 5, 'retried 4 times');
                assert.end();
            });
        });
    });
});

test('getTile retry on content-length mismatch', function(assert) {
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/lengthget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.getTile(3, 6, 5, function(err) {
                assert.equal(err.code, 'TruncatedResponseError', 'expected error code');
                assert.equal(err.message, '[x-amz-id-2:01234567] [x-amz-request-id:0000000000000000] Content-Length does not match response body length', 'expected message');
                assert.equal(err.statusCode, 500, 'expected statusCode');
                assert.equal(attempts, 5, 'retried 4 times');
                assert.end();
            });
        });
    });
});
