// Set env key/secret before requiring tilelive-s3.
process.env.HOME = __dirname + '/fixtures';

var assert = require('assert');
var path = require('path');
var fs = require('fs');
var S3 = require('..');
var knox = require('knox');
var crypto = require('crypto');
var fixtures = path.resolve(__dirname + '/fixtures');
var AWS = require('aws-sdk');
var awss3 = new AWS.S3();

var s3;
var vt;
before(function(done) {
    new S3({
        pathname: fixtures + '/test.s3',
    }, function(err, source) {
        if (err) return done(err);
        s3 = source;
        done();
    });
});
before(function(done) {
    new S3({
        pathname: fixtures + '/vector.s3',
    }, function(err, source) {
        if (err) return done(err);
        vt = source;
        done();
    });
});

describe('alpha masks', function() {
    it('should load the alpha mask for a tile', function(done) {
        s3._loadTileMask(3, 6, 5, function(err, mask) {
            if (err) throw err;
            assert.equal(mask.length, 65536);
            assert.equal(crypto.createHash('md5').update(mask).digest('hex'), 'f91ed545992905450cfe38c591ef345c');
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

describe('getTile png', function() {
    it('should return a unique tile', function(done) {
        s3.getTile(4, 12, 11, function(err, tile, headers) {
            if (err) throw err;
            assert.equal(1072, tile.length);
            assert.equal(headers['Content-Type'], 'image/png');
            assert.equal(headers['ETag'], '"2ba883e676e537d3da13e34d46e25044"');
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
        s3.getTile(4, 12, 13, function(err, tile, headers) {
            if (err) throw err;
            assert.equal(103, tile.length);
            assert.equal(headers['Content-Type'], 'image/png');
            assert.equal(headers['ETag'], '"1d6c3b07cc05d966d0029884fd4f58cc"');
            done();
        });
    });
});

describe('getTile pbf', function() {
    it('should return a vt', function(done) {
        vt.getTile(0, 0, 0, function(err, tile, headers) {
            if (err) throw err;
            assert.equal(40094, tile.length);
            assert.equal(headers['Content-Type'], 'application/x-protobuf');
            assert.equal(headers['ETag'], '"b992f1bb4a989bbb9ed2c6989719f72b"');
            done();
        });
    });
    it('should err 404', function(done) {
        vt.getTile(2, 0, 0, function(err, tile) {
            assert.equal(err.message, 'Tile does not exist');
            done();
        });
    });
});

describe('putTile', function() {
    before(function(done) {
        awss3.deleteObject({
            Bucket: 'mapbox',
            Key: 'tilelive-s3/test/3/6/5.png'
        }, done);
    });
    before(function(done) {
        awss3.deleteObject({
            Bucket: 'mapbox',
            Key: 'tilelive-s3/vector/3/6/5.png'
        }, done);
    });

    it('puts a PNG tile', function(done) {
        var png = fs.readFileSync(fixtures + '/tile.png');
        s3.startWriting(function(err) {
            assert.ifError(err);
            s3.putTile(3, 6, 5, png, function(err) {
                assert.ifError(err);
                s3.client.headFile('/tilelive-s3/test/3/6/5.png', function(err, res) {
                    assert.ifError(err);
                    assert.equal(res.headers['content-type'], 'image/png');
                    assert.equal(res.headers['content-length'], '827');
                    assert.equal(res.headers['content-encoding'], undefined);
                    done();
                });
            });
        });
    });

    it('puts a PBF tile', function(done) {
        var pbf = fs.readFileSync(fixtures + '/tile.pbf.gz');
        vt.startWriting(function(err) {
            assert.ifError(err);
            vt.putTile(3, 6, 5, pbf, function(err) {
                assert.ifError(err);
                vt.client.headFile('/tilelive-s3/vector/3/6/5.vector.pbf', function(err, res) {
                    assert.ifError(err);
                    assert.equal(res.headers['content-type'], 'application/x-protobuf');
                    assert.equal(res.headers['content-length'], '40115');
                    assert.equal(res.headers['content-encoding'], 'gzip');
                    done();
                });
            });
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
        done();
    });
});

describe('notfound', function() {
    it('should return a unique tile', function(done) {
        nf.getTile(4, 12, 11, function(err, tile, headers) {
            if (err) throw err;
            assert.equal(1072, tile.length);
            assert.equal(headers['Content-Type'], 'image/png');
            assert.equal(headers['ETag'], '"2ba883e676e537d3da13e34d46e25044"');
            done();
        });
    });

    it('should return error tile', function(done) {
        nf.getTile(0, 255, 255, function(err, tile, headers) {
            if (err) throw err;
            assert.equal(103, tile.length);
            assert.equal(headers['Content-Type'], 'image/png');
            assert.equal(headers['ETag'], '"1d6c3b07cc05d966d0029884fd4f58cc"');
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
    var orig = {};
    before(function() {
        ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'].forEach(function(k) {
            orig[k] = process.env[k];
            delete process.env[k];
        });
    });
    after(function() {
        ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'].forEach(function(k) {
            process.env[k] = orig[k];
        });
    });
    it('should ignore data credentials', function(done) {
        new S3({
            data: {
                tiles: [ "http://dummy-bucket.s3.amazonaws.com/test/{z}/{x}/{y}.png" ],
                awsKey: "DATAKEY",
                awsSecret: "DATASECRET"
            },
            awsKey: "URIKEY",
            awsSecret: "URISECRET"
        }, function(err, source) {
            if (err) return done(err);
            assert.ok(!source.client);
            done();
        });
    });
    it('should ignore uri credentials', function(done) {
        new S3({
            data: {
                tiles: [ "http://dummy-bucket.s3.amazonaws.com/test/{z}/{x}/{y}.png" ]
            },
            awsKey: "URIKEY",
            awsSecret: "URISECRET"
        }, function(err, source) {
            if (err) return done(err);
            assert.ok(!source.client);
            done();
        });
    });
    it('should ignore .s3cfg credentials', function(done) {
        new S3({
            data: {
                tiles: [ "http://dummy-bucket.s3.amazonaws.com/test/{z}/{x}/{y}.png" ]
            }
        }, function(err, source) {
            if (err) return done(err);
            assert.ok(!source.client);
            done();
        });
    });
    it('should create client from env credentials', function(done) {
        process.env.AWS_ACCESS_KEY_ID = 'ENVKEY';
        process.env.AWS_SECRET_ACCESS_KEY = 'ENVSECRET';
        process.env.AWS_SESSION_TOKEN = 'ENVTOKEN';
        new S3({
            data: {
                tiles: [ "http://dummy-bucket.s3.amazonaws.com/test/{z}/{x}/{y}.png" ]
            }
        }, function(err, source) {
            if (err) return done(err);
            assert.ok(!source.client);
            source.startWriting(function(err) {
                if (err) return done(err);
                assert.ok(!!source.client);
                assert.equal('ENVKEY', source.client.key);
                assert.equal('ENVSECRET', source.client.secret);
                assert.equal('ENVTOKEN', source.client.token);
                done();
            });
        });
    });
    it('should use client passed in via uri', function(done) {
        new S3({
            data: {
                tiles: [ "http://dummy-bucket.s3.amazonaws.com/test/{z}/{x}/{y}.png" ]
            },
            client: knox.createClient({
                bucket: "dummy-bucket",
                key: "CLIENTKEY",
                secret: "CLIENTSECRET"
            })
        }, function(err, source) {
            if (err) return done(err);
            assert.ok(!!source.client);
            assert.equal('CLIENTKEY', source.client.key);
            assert.equal('CLIENTSECRET', source.client.secret);
            // Call to startWriting should not touch the client.
            source.startWriting(function(err) {
                if (err) return done(err);
                assert.ok(!!source.client);
                assert.equal('CLIENTKEY', source.client.key);
                assert.equal('CLIENTSECRET', source.client.secret);
                done();
            });
        });
    });
});

describe('error', function() {
    it('source load error should fail gracefully', function(done) {
        new S3({}, function(err, source) {
            assert.ok(err);
            assert.equal('Invalid URI ', err.message);
            done();
        });
    });
});

describe('geocoder (carmen) API', function() {

var expected = {
    bounds: '-141.005548666451,41.6690855919108,-52.615930948992,83.1161164353916',
    lat: 56.8354595949484,
    lon: -110.424643384994,
    name: 'Canada',
    population: 33487208,
    search: 'Canada, CA'
};

var from = new S3({data:JSON.parse(fs.readFileSync(__dirname + '/fixtures/geocoder.s3'))}, function() {});
var prefixed = new S3({data:JSON.parse(fs.readFileSync(__dirname + '/fixtures/geocoder.prefixed.s3'))}, function() {});

it('getGeocoderData', function(done) {
    from.getGeocoderData('term', 0, function(err, buffer) {
        assert.ifError(err);
        assert.equal(3891, buffer.length);
        done();
    });
});

it('getGeocoderData (prefixed source)', function(done) {
    prefixed.getGeocoderData('term', 0, function(err, buffer) {
        assert.ifError(err);
        assert.equal(3891, buffer.length);
        done();
    });
});

it.skip('putGeocoderData', function(done) {
    to.startWriting(function(err) {
        assert.ifError(err);
        to.putGeocoderData('term', 0, new Buffer('asdf'), function(err) {
            assert.ifError(err);
            to.stopWriting(function(err) {
                assert.ifError(err);
                to.getGeocoderData('term', 0, function(err, buffer) {
                    assert.ifError(err);
                    assert.deepEqual('asdf', buffer.toString());
                    done();
                });
            });
        });
    });
});

it('getIndexableDocs', function(done) {
    from.getIndexableDocs({}, function(err, docs, pointer) {
        assert.ifError(err);
        assert.equal(docs.length, 63);
        assert.deepEqual(pointer, {shard:1});
        from.getIndexableDocs(pointer, function(err, docs, pointer) {
            assert.ifError(err);
            assert.equal(docs.length, 64);
            assert.deepEqual(pointer, {shard:2});
            done();
        });
    });
});

it('getIndexableDocs (prefixed source)', function(done) {
    prefixed.getIndexableDocs({}, function(err, docs, pointer) {
        assert.ifError(err);
        assert.equal(docs.length, 63);
        assert.deepEqual(pointer, {shard:1});
        prefixed.getIndexableDocs(pointer, function(err, docs, pointer) {
            assert.ifError(err);
            assert.equal(64, docs.length);
            assert.equal('64', docs[0]._id);
            assert.deepEqual(pointer, {shard:2});
            prefixed.getIndexableDocs(pointer, function(err, docs, pointer) {
                assert.ifError(err);
                assert.equal(64, docs.length);
                assert.equal('128', docs[0]._id);
                assert.deepEqual(pointer, {shard:3});
                done();
            });
        });
    });
});

});

