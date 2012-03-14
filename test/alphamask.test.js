var assert = require('assert');
var fs = require('fs');
var S3 = require('..');

// Mock tile loading.
function _loadTileFS(z, x, y, callback) {
    fs.readFile('./test/fixtures/' + this.data.name + '/' + z + '/' + x + '/' + y + '.png', function(err, buffer) {
        if (err) callback(err);
        else callback(err, buffer, {
            'Content-Type': 'image/png',
            'Content-Length': buffer.length
        });
    });
};

var s3;
before(function(done) {
    new S3({
        pathname: './test/fixtures/test.s3',
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
            var reference = fs.readFileSync('./test/fixtures/test/3/6/5.mask');
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
            var reference = fs.readFileSync('./test/fixtures/test/4/12/11.png');
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
            var reference = fs.readFileSync('./test/fixtures/test/3/6/7.png');
            assert.deepEqual(tile, reference);
            done();
        });
    });
});
