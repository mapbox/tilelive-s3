var tape = require('tape');
var S3 = require('..');
var knox = require('knox');
var http = require('http');
var path = require('path');
var fs = require('fs');
var fixtures = path.resolve(__dirname + '/fixtures');

var client = knox.createClient({
    bucket: 'dummy-bucket',
    key: 'CLIENTKEY',
    secret: 'CLIENTSECRET',
    endpoint: 'localhost',
    style: 'path',
    port: 20009
});

var mock = http.createServer(function (req, res) {
    if (req.method == 'GET' && req.url.match(/^\/dummy-bucket\/slowget(\/\d){3}.png$/)) {
        setTimeout(function() {
            res.writeHead(200);
            res.end();
        }, 10000);
    } else if (req.method == 'GET') {
        res.writeHead(404);
        res.end();
    } else if (req.method == 'PUT' && req.url.match(/^\/dummy-bucket\/slowput(\/\d){3}.png$/)) {
        setTimeout(function() {
            res.writeHead(200);
            res.end();
        }, 10000);
    } else if (req.method == 'PUT' && req.url.match(/^\/dummy-bucket\/hangup(\/\d){3}.png$/)) {
        req.socket.destroy();
    } else if (req.method == 'PUT' && req.url.match(/^\/dummy-bucket\/httperror(\/\d){3}.png$/)) {
        var body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                   '<Error>\n' +
                   '  <Code>SlowDown</Code>\n' +
                   '  <Message>Reduce your request rate</Message>\n' +
                   '</Error>';
        res.writeHead(503);
        res.end(body);
    } else if (req.method == 'PUT' && req.url.match(/^\/dummy-bucket\/httperrornobody(\/\d){3}.png$/)) {
        res.writeHead(503);
        res.end();
    } else {
        res.writeHead(404);
        res.end();
    }
}).listen(20009, '127.0.0.1');

tape('putTile retry on GET timeout', function(assert) {
    var png = fs.readFileSync(fixtures + '/tile.png');
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/slowget/{z}/{x}/{y}.png' ]
        },
        client: client
    }, function(err, source) {
        assert.ifError(err);
        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.equal(err.message, 'Timed out after 5000ms');
                assert.equal(err.status, 504);
                assert.end();
            });
        });
    });
});

tape('putTile retry on PUT timeout', function(assert) {
    var png = fs.readFileSync(fixtures + '/tile.png');

    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/slowput/{z}/{x}/{y}.png' ]
        },
        client: client
    }, function(err, source) {
        assert.ifError(err);
        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.equal(err.message, 'socket hang up');
                assert.equal(err.code, 'ECONNRESET');
                assert.end();
            });
        });
    });
});

tape('putTile retry on server closed connection', function(assert) {
    var png = fs.readFileSync(fixtures + '/tile.png');

    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/hangup/{z}/{x}/{y}.png' ]
        },
        client: client
    }, function(err, source) {
        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.equal(err.message, 'socket hang up');
                assert.equal(err.code, 'ECONNRESET');
                assert.end();
            });
        });
    });
});

tape('putTile retry on http error', function(assert) {
    var png = fs.readFileSync(fixtures + '/tile.png');

    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/httperror/{z}/{x}/{y}.png' ]
        },
        client: client
    }, function(err, source) {
        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.equal(err.message, 'S3 put failed: 503 SlowDown');
                assert.end();
            });
        });
    });
});

tape('putTile retry on http error (no body)', function(assert) {
    var png = fs.readFileSync(fixtures + '/tile.png');

    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/httperrornobody/{z}/{x}/{y}.png' ]
        },
        client: client
    }, function(err, source) {
        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.equal(err.message, 'S3 put failed: 503 Unknown');
                assert.end();
            });
        });
    });
});

tape('mock server teardown', function(assert) {
    mock.close(assert.end);
});

tape('_retry', function(assert) {
    var start = Date.now();

    function func() {
        S3._retry(func, callback)(new Error('Something went wrong'));
    };

    func();

    function callback(err) {
        var duration = Date.now() - start;
        assert.equal(err.message, 'Something went wrong');
        assert.equal(func._retry, 3);
        assert.ok(duration >= 6000, 'should not happen to quickly');
        assert.ok(duration <= 6010, 'should not take too long');
        assert.end();
    }
});
