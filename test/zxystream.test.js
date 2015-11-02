var AWS = require('aws-sdk');
var awss3 = new AWS.S3();
var fs = require('fs');
var tape = require('tape');
var ZXYStream = require('../lib/zxystream');

tape('config', function(assert) {
    assert.deepEqual(ZXYStream.config('http://mapbox.s3.amazonaws.com/tilelive-s3/test/zxystream-unprefixed/{z}/{x}/{y}'), {
        toList: [ 's3://mapbox/tilelive-s3/test/zxystream-unprefixed/' ],
        tokenMap: [ 1, 2, 3 ],
        tokenPattern: /tilelive-s3\/test\/zxystream-unprefixed\/([0-9]+)\/([0-9]+)\/([0-9]+)/
    }, 'z/x/y order');
    assert.deepEqual(ZXYStream.config('http://mapbox.s3.amazonaws.com/tilelive-s3/test/zxystream-unprefixed/{x}/{z}/{y}'), {
        toList: [ 's3://mapbox/tilelive-s3/test/zxystream-unprefixed/' ],
        tokenMap: [ 2, 1, 3 ],
        tokenPattern: /tilelive-s3\/test\/zxystream-unprefixed\/([0-9]+)\/([0-9]+)\/([0-9]+)/
    }, 'x/y/z order');
    assert.deepEqual(ZXYStream.config('http://mapbox.s3.amazonaws.com/tilelive-s3/test/zxystream-prefixed/{prefix}/{z}/{x}/{y}'), {
        toList: [
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/00/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/01/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/02/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/03/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/04/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/05/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/06/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/07/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/08/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/09/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/0a/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/0b/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/0c/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/0d/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/0e/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/0f/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/10/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/11/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/12/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/13/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/14/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/15/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/16/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/17/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/18/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/19/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/1a/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/1b/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/1c/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/1d/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/1e/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/1f/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/20/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/21/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/22/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/23/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/24/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/25/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/26/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/27/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/28/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/29/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/2a/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/2b/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/2c/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/2d/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/2e/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/2f/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/30/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/31/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/32/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/33/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/34/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/35/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/36/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/37/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/38/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/39/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/3a/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/3b/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/3c/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/3d/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/3e/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/3f/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/40/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/41/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/42/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/43/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/44/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/45/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/46/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/47/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/48/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/49/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/4a/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/4b/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/4c/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/4d/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/4e/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/4f/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/50/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/51/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/52/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/53/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/54/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/55/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/56/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/57/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/58/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/59/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/5a/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/5b/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/5c/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/5d/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/5e/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/5f/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/60/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/61/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/62/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/63/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/64/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/65/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/66/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/67/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/68/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/69/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/6a/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/6b/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/6c/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/6d/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/6e/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/6f/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/70/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/71/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/72/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/73/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/74/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/75/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/76/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/77/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/78/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/79/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/7a/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/7b/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/7c/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/7d/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/7e/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/7f/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/80/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/81/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/82/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/83/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/84/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/85/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/86/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/87/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/88/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/89/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/8a/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/8b/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/8c/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/8d/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/8e/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/8f/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/90/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/91/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/92/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/93/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/94/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/95/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/96/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/97/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/98/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/99/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/9a/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/9b/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/9c/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/9d/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/9e/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/9f/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/a0/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/a1/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/a2/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/a3/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/a4/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/a5/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/a6/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/a7/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/a8/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/a9/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/aa/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ab/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ac/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ad/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ae/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/af/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/b0/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/b1/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/b2/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/b3/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/b4/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/b5/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/b6/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/b7/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/b8/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/b9/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ba/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/bb/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/bc/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/bd/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/be/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/bf/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/c0/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/c1/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/c2/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/c3/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/c4/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/c5/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/c6/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/c7/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/c8/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/c9/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ca/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/cb/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/cc/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/cd/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ce/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/cf/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/d0/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/d1/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/d2/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/d3/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/d4/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/d5/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/d6/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/d7/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/d8/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/d9/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/da/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/db/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/dc/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/dd/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/de/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/df/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/e0/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/e1/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/e2/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/e3/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/e4/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/e5/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/e6/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/e7/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/e8/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/e9/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ea/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/eb/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ec/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ed/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ee/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ef/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/f0/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/f1/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/f2/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/f3/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/f4/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/f5/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/f6/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/f7/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/f8/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/f9/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/fa/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/fb/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/fc/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/fd/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/fe/',
            's3://mapbox/tilelive-s3/test/zxystream-prefixed/ff/'
        ],
        tokenMap: [ 1, 2, 3 ],
        tokenPattern: /tilelive-s3\/test\/zxystream-unprefixed\/([0-9]+)\/([0-9]+)\/([0-9]+)/
    });
    assert.end();
});


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

[ '00/8/0/0', '10/8/1/0', '01/8/0/1', '11/8/1/1', '21/8/2/1', '22/8/2/2', 'ff/8/15/15' ].forEach(function(prefixed) {
    tape('setup tile ' + prefixed, function(assert) {
        var png = fs.readFileSync(__dirname + '/fixtures/tile.png');
        awss3.putObject({
            Bucket: 'mapbox',
            Key: 'tilelive-s3/test/zxystream-prefixed/' + prefixed,
            Body: png
        }, assert.end);
    });
});

tape('ZXYStream (unprefixed)', function(assert) {
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

tape('ZXYStream (prefixed)', function(assert) {
    var stream = ZXYStream('http://mapbox.s3.amazonaws.com/tilelive-s3/test/zxystream-prefixed/{prefix}/{z}/{x}/{y}');
    var lines = [];
    stream.on('data', function(line) {
        lines.push(line);
    });
    stream.on('end', function() {
        assert.deepEqual(lines, [
            '8/0/0',
            '8/0/1',
            '8/1/0',
            '8/1/1',
            '8/2/1',
            '8/2/2',
            '8/15/15'
        ]);
        assert.end();
    });
});

