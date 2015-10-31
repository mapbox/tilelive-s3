var AWS = require('aws-sdk');
var awss3 = new AWS.S3();
var fs = require('fs');
var tape = require('tape');
var ZXYStream = require('../lib/zxystream');

[ '0/0/0', '1/0/0', '1/0/1', '1/1/0', '1/1/1' ].forEach(function(zxy) {
    tape('setup tile ' + zxy, function(assert) {
        var png = fs.readFileSync(__dirname + '/fixtures/tile.png');
        awss3.putObject({
            Bucket: 'mapbox',
            Key: 'tilelive-s3/test/zxystream-unprefixed/' + zxy,
            Body: png
        }, assert.end);
    });
});

tape('ZXYStream', function(assert) {
    var stream = ZXYStream('http://mapbox.s3.amazonaws.com/tilelive-s3/test/zxystream-unprefixed/{z}/{x}/{y}');
    var lines = [];
    stream.on('data', function(line) {
        lines.push(line);
    });
    stream.on('end', function() {
        assert.deepEqual(lines, [
            '0/0/0',
            '1/0/0',
            '1/0/1',
            '1/1/0',
            '1/1/1'
        ]);
        assert.end();
    });
});

tape('config', function(assert) {
    assert.deepEqual(ZXYStream.config('http://mapbox.s3.amazonaws.com/tilelive-s3/test/zxystream-unprefixed/{z}/{x}/{y}'), {
        toList: [ 's3://mapbox/tilelive-s3/test/zxystream-unprefixed/' ],
        tokenMap: [ 1, 2, 3 ],
        tokenPattern: /tilelive-s3\/test\/zxystream-unprefixed\/([0-9]+)\/([0-9]+)\/([0-9]+)/
    });
    assert.end();
});

