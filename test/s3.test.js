var assert = require('assert');
var path = require('path');
var fs = require('fs');
var S3 = require('..');
var knox = require('knox');
var fixtures = path.resolve(__dirname + '/fixtures');

// Mock tile loading.
function _loadTileFS(z, x, y, callback) {
    fs.readFile(fixtures + '/' + this.data.name + '/' + z + '/' + x + '/' + y + '.png', function(err, buffer) {
        if (err && err.code === 'ENOENT') callback(new Error('Tile does not exist'));
        else if (err) callback(err);
        else callback(err, buffer, {
            'Content-Type': 'image/png',
            'Content-Length': buffer.length
        });
    });
};

var s3;
before(function(done) {
    new S3({
        pathname: fixtures + '/test.s3',
    }, function(err, source) {
        if (err) return done(err);
        s3 = source;
        s3._loadTile = _loadTileFS;
        done();
    });
});

describe('alpha masks', function() {
    it('should load the alpha mask for a tile', function(done) {
        s3._loadTileMask(3, 6, 5, function(err, mask) {
            if (err) throw err;
            var reference = fs.readFileSync(fixtures + '/test/3/6/5.mask');
            assert.deepEqual(reference, mask);
            done();
        });
    });
});

describe('getting a tile color', function() {
    it('should return color false for an existing tile', function(done) {
        s3._getColor(4, 12, 11, function(err, color) {
            if (err) throw err;
            assert.equal(color, false);
            done();
        });
    });

    it('should return blank for a blank tile', function(done) {
        s3._getColor(4, 12, 10, function(err, color) {
            if (err) throw err;
            assert.equal(color, 0);
            done();
        });
    });

    it('should return color #7f7f7f for a solid tile', function(done) {
        s3._getColor(4, 12, 13, function(err, color) {
            if (err) throw err;
            assert.equal(color, 255);
            done();
        });
    });
});

describe('loading a tile', function() {
    it('should return a unique tile', function(done) {
        s3.getTile(4, 12, 11, function(err, tile) {
            if (err) throw err;
            var reference = fs.readFileSync(fixtures + '/test/4/12/11.png');
            assert.deepEqual(reference, tile);
            done();
        });
    });

    it('should return a blank tile', function(done) {
        s3.getTile(4, 12, 10, function(err) {
            assert.ok(err);
            assert.equal(err.message, 'Tile does not exist');
            done();
        });
    });

    it('should return a solid tile', function(done) {
        s3.getTile(4, 12, 13, function(err, tile) {
            if (err) throw err;
            var reference = fs.readFileSync(fixtures + '/test/3/6/7.png');
            assert.deepEqual(tile, reference);
            done();
        });
    });
});

var nf;
before(function(done) {
    new S3({
        pathname: fixtures + '/notfound.s3',
    }, function(err, source) {
        if (err) return done(err);
        nf = source;
        nf._loadTile = _loadTileFS;
        done();
    });
});

describe('notfound', function() {
    it('should return a unique tile', function(done) {
        nf.getTile(4, 12, 11, function(err, tile) {
            if (err) throw err;
            var reference = fs.readFileSync(fixtures + '/test/4/12/11.png');
            assert.deepEqual(reference, tile);
            done();
        });
    });

    it('should return error tile', function(done) {
        nf.getTile(0, 255, 255, function(err, tile) {
            if (err) throw err;
            var reference = fs.readFileSync(fixtures + '/test/3/6/7.png');
            assert.deepEqual(tile, reference);
            done();
        });
    });
});

describe('info', function() {
    it('should not include custom keys', function(done) {
        nf.getInfo(function(err, info) {
            if (err) throw err;
            assert.ok(!('awsKey' in info));
            assert.ok(!('awsSecret' in info));
            assert.ok(!('notFound' in info));
            assert.ok(!('maskLevel' in info));
            assert.ok(!('maskSolid' in info));
            assert.ok(!('maxSockets' in info));
            assert.ok(!('retry' in info));
            done();
        });
    });
});

describe('credentials', function() {
    it('should create client from data credentials', function(done) {
        new S3({
            data: {
                tiles: [ "http://dummy-bucket.s3.amazonaws.com/test/{z}/{x}/{y}.png" ],
                awsKey: "XXXXXXXX",
                awsSecret: "XXXXXXXXXXXXXXXX"
            }
        }, function(err, source) {
            if (err) return done(err);
            assert.ok(!!source.client);
            done();
        });
    });
    it('should create client from uri credentials', function(done) {
        new S3({
            data: {
                tiles: [ "http://dummy-bucket.s3.amazonaws.com/test/{z}/{x}/{y}.png" ]
            },
            awsKey: "XXXXXXXX",
            awsSecret: "XXXXXXXXXXXXXXXX"
        }, function(err, source) {
            if (err) return done(err);
            assert.ok(!!source.client);
            done();
        });
    });
    it('should use client passed in via uri', function(done) {
        new S3({
            data: {
                tiles: [ "http://dummy-bucket.s3.amazonaws.com/test/{z}/{x}/{y}.png" ]
            },
            client: knox.createClient({
                bucket: "dummy-bucket",
                key: "XXXXXXXX",
                secret: "XXXXXXXXXXXXXXXX"
            })
        }, function(err, source) {
            if (err) return done(err);
            assert.ok(!!source.client);
            done();
        });
    });
});
