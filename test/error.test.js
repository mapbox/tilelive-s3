var tape = require('tape');
var S3 = require('..');
var http = require('http');
var path = require('path');
var fs = require('fs');
var fixtures = path.resolve(__dirname + '/fixtures');
var AWS = require('aws-sdk');

var mock = http.createServer(function (req, res) {
    if (req.method == 'GET' && req.url.match(/^\/slowget(\/\d){3}.png$/)) {
        setTimeout(function() {
            res.writeHead(200);
            res.end();
        }, 10000);
    } else if (req.method == 'GET') {
        res.writeHead(404);
        res.end();
    } else if (req.method == 'PUT' && req.url.match(/^\/slowput(\/\d){3}.png$/)) {
        setTimeout(function() {
            res.writeHead(200);
            res.end();
        }, 10000);
    } else if (req.method == 'PUT' && req.url.match(/^\/hangup(\/\d){3}.png$/)) {
        req.socket.destroy();
    } else if (req.method == 'PUT' && req.url.match(/^\/httperror(\/\d){3}.png$/)) {
        var body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                   '<Error>\n' +
                   '  <Code>SlowDown</Code>\n' +
                   '  <Message>Reduce your request rate</Message>\n' +
                   '</Error>';
        res.writeHead(503);
        res.end(body);
    } else if (req.method == 'PUT' && req.url.match(/^\/httperrornobody(\/\d){3}.png$/)) {
        res.writeHead(503);
        res.end();
    } else {
        res.writeHead(404);
        res.end();
    }
});

tape('start mock', function(assert) {
    mock.listen(20009, function() {
        // aws-sdk overrides to get tilelive-s3 to talk to the mock server
        S3.agent = http.globalAgent;
        AWS.config.update({
            endpoint: new AWS.Endpoint('http://localhost:20009'),
            s3BucketEndpoint: true
        });

        assert.end();
    });
});

tape('putTile retry on GET timeout', function(assert) {
    var png = fs.readFileSync(fixtures + '/tile.png');
    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/slowget/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);

        source.startWriting(function(err) {
            if (err) return done(err);
            source.getTile(3, 6, 5, function(err) {
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
        }
    }, function(err, source) {
        assert.ifError(err);
        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.equal(err.message, 'ETIMEDOUT');
                assert.equal(err.status, undefined);
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
        }
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

tape('putTile retry on http error', function(assert) {
    var png = fs.readFileSync(fixtures + '/tile.png');

    new S3({
        data: {
            tiles: [ 'http://dummy-bucket.s3.amazonaws.com/httperror/{z}/{x}/{y}.png' ]
        }
    }, function(err, source) {
        assert.ifError(err);
        source.startWriting(function(err) {
            if (err) return done(err);
            source.putTile(3, 6, 5, png, function(err) {
                assert.equal(err.message, 'Reduce your request rate');
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
        }
    }, function(err, source) {
        assert.ifError(err);
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
