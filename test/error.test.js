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
                assert.ifError(err);
                assert.end();
            });
        });
    });
});

tape('teardown', function(assert) {
    mock.close(assert.end);
});

