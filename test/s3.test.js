// Set env key/secret before requiring tilelive-s3.
process.env.HOME = __dirname + '/fixtures';

var tape = require('tape');
var path = require('path');
var fs = require('fs');
var S3 = require('..');
var crypto = require('crypto');
var fixtures = path.resolve(__dirname + '/fixtures');
var AWS = require('aws-sdk');
var awss3 = new AWS.S3();
var url = require('url');

delete process.env.TILELIVE_S3_DRYRUN;
delete process.env.TILELIVE_S3_STATS;

var s3;
var vt;
var nf;

tape('setup', function(assert) {
    new S3({
        pathname: fixtures + '/test.s3',
    }, function(err, source) {
        assert.ifError(err);
        s3 = source;
        assert.end();
    });
});

tape('setup', function(assert) {
    new S3({
        pathname: fixtures + '/vector.s3',
    }, function(err, source) {
        assert.ifError(err);
        vt = source;
        assert.end();
    });
});

tape('setup', function(assert) {
    new S3({
        pathname: fixtures + '/notfound.s3',
    }, function(err, source) {
        assert.ifError(err);
        nf = source;
        assert.end();
    });
});

tape('setup', function(assert) {
    var png = fs.readFileSync(fixtures + '/tile.png');
    s3.startWriting(function(err) {
        assert.ifError(err);
        s3.putTile(3, 6, 5, png, function(err) {
            assert.ifError(err);
            assert.end();
        });
    });
});

tape('should load the alpha mask for a tile', function(assert) {
    s3._loadTileMask(3, 6, 5, function(err, mask) {
        if (err) throw err;
        assert.equal(mask.length, 65536);
        assert.equal(crypto.createHash('md5').update(mask).digest('hex'), 'f91ed545992905450cfe38c591ef345c');
        assert.end();
    });
});

tape('should return color false for an existing tile', function(assert) {
    s3._getColor(4, 12, 11, function(err, color) {
        if (err) throw err;
        assert.equal(color, false);
        assert.end();
    });
});

tape('should return blank for a blank tile', function(assert) {
    s3._getColor(4, 12, 10, function(err, color) {
        if (err) throw err;
        assert.equal(color, 0);
        assert.end();
    });
});

tape('should return color #7f7f7f for a solid tile', function(assert) {
    s3._getColor(4, 12, 13, function(err, color) {
        if (err) throw err;
        assert.equal(color, 255);
        assert.end();
    });
});

tape('should return a unique tile', function(assert) {
    s3.getTile(4, 12, 11, function(err, tile, headers) {
        if (err) throw err;
        assert.equal(1072, tile.length);
        assert.equal(headers['Content-Type'], 'image/png');
        assert.equal(headers['ETag'], '"2ba883e676e537d3da13e34d46e25044"');
        assert.end();
    });
});

tape('setup source with S3 URI', function(assert) {
    new S3(url.parse('s3://mapbox/tilelive-s3/test/{z}/{x}/{y}.png'), function(err, source) {
        assert.ifError(err, 'success');
        if (err) return assert.end();
        source.getTile(4, 12, 11, function(err, tile, headers) {
            assert.ifError(err, 'got tile');
            if (err) return assert.end();
            assert.equal(1072, tile.length, 'got expected data');
            assert.end();
        });
    });
});

tape('should return a blank tile', function(assert) {
    s3.getTile(4, 12, 10, function(err) {
        assert.ok(err);
        assert.equal(err.message, 'Tile does not exist');
        assert.end();
    });
});

tape('should return a solid tile', function(assert) {
    s3.getTile(4, 12, 13, function(err, tile, headers) {
        if (err) throw err;
        assert.equal(103, tile.length);
        assert.equal(headers['Content-Type'], 'image/png');
        assert.equal(headers['ETag'], '"1d6c3b07cc05d966d0029884fd4f58cc"');
        assert.end();
    });
});

tape('should return a vt', function(assert) {
    vt.getTile(0, 0, 0, function(err, tile, headers) {
        if (err) throw err;
        assert.equal(40094, tile.length);
        assert.equal(headers['Content-Type'], 'application/x-protobuf');
        assert.equal(headers['ETag'], '"b992f1bb4a989bbb9ed2c6989719f72b"');
        assert.end();
    });
});

tape('should err 404', function(assert) {
    vt.getTile(2, 0, 0, function(err, tile) {
        assert.equal(err.message, 'Tile does not exist');
        assert.end();
    });
});

tape('setup', function(assert) {
    awss3.deleteObject({
        Bucket: 'mapbox',
        Key: 'tilelive-s3/test/3/6/5.png'
    }, assert.end);
});

tape('setup', function(assert) {
    awss3.deleteObject({
        Bucket: 'mapbox',
        Key: 'tilelive-s3/vector/3/6/5.png'
    }, assert.end);
});

tape('puts a PNG tile', function(assert) {
    var png = fs.readFileSync(fixtures + '/tile.png');
    var get = s3._stats.get;
    var put = s3._stats.put;
    var noop = s3._stats.noop;
    var txin = s3._stats.txin;
    var txout = s3._stats.txout;
    s3.startWriting(function(err) {
        assert.ifError(err);
        putTile();
    });

    // First PUT.
    function putTile() {
        s3.putTile(3, 6, 5, png, function(err) {
            assert.ifError(err);
            assert.equal(s3._stats.get - get, 1, 'stats: +1 get');
            assert.equal(s3._stats.put - put, 1, 'stats: +1 put');
            assert.equal(s3._stats.noop - noop, 0, 'stats: +0 noop');
            assert.equal(s3._stats.txin - txin, 0, 'stats: +0 txin');
            assert.equal(s3._stats.txout - txout, 827, 'stats +827 txout');
            head();
        });
    }

    // Confirm obj is written.
    function head() {
        awss3.headObject({
            Bucket: 'mapbox',
            Key: 'tilelive-s3/test/3/6/5.png'
        }, function(err, res) {
            assert.ifError(err);
            assert.equal(res.ContentType, 'image/png');
            assert.equal(res.ContentLength, '827');
            putTile2();
        });
    }

    // Noop PUT.
    function putTile2() {
        var get = s3._stats.get;
        var put = s3._stats.put;
        var noop = s3._stats.noop;
        var txin = s3._stats.txin;
        var txout = s3._stats.txout;
        s3.putTile(3, 6, 5, png, function(err) {
            assert.ifError(err);
            assert.equal(s3._stats.get - get, 1, 'stats: +1 get');
            assert.equal(s3._stats.put - put, 0, 'stats: +0 put');
            assert.equal(s3._stats.noop - noop, 1, 'stats: +1 noop');
            assert.equal(s3._stats.txin - txin, 827, 'stats: +827 txin');
            assert.equal(s3._stats.txout - txout, 0, 'stats +0 txout');
            assert.end();
        });
    }
});

tape('puts a PNG tile (noop)', function(assert) {
    var png = fs.readFileSync(fixtures + '/tile.png');
    var get = s3._stats.get;
    var put = s3._stats.put;
    var noop = s3._stats.noop;
    var txin = s3._stats.txin;
    var txout = s3._stats.txout;
    s3.putTile(3, 6, 5, png, function(err) {
        assert.ifError(err);
        assert.equal(s3._stats.get - get, 1, 'stats: +1 get');
        assert.equal(s3._stats.put - put, 0, 'stats: +0 put');
        assert.equal(s3._stats.noop - noop, 1, 'stats: +1 noop');
        assert.equal(s3._stats.txin - txin, 827, 'stats: +827 txin');
        assert.equal(s3._stats.txout - txout, 0, 'stats +0 txout');
        assert.end();
    });
});

tape('puts a PNG tile (dryrun)', function(assert) {
    process.env.TILELIVE_S3_DRYRUN = '1';
    var png = fs.readFileSync(fixtures + '/tile.png');
    var get = s3._stats.get;
    var put = s3._stats.put;
    var noop = s3._stats.noop;
    var txin = s3._stats.txin;
    var txout = s3._stats.txout;
    s3.putTile(10, 0, 0, png, function(err) {
        assert.ifError(err);
        assert.equal(s3._stats.get - get, 1, 'stats: +1 get');
        assert.equal(s3._stats.put - put, 1, 'stats: +1 put');
        assert.equal(s3._stats.noop - noop, 0, 'stats: +0 noop');
        assert.equal(s3._stats.txin - txin, 0, 'stats: +0 txin');
        assert.equal(s3._stats.txout - txout, 827, 'stats +827 txout');
        delete process.env.TILELIVE_S3_DRYRUN;
        assert.end();
    });
});

tape('stopWriting (no stats)', function(assert) {
    var origlog = console.log;
    var stdout = [];
    console.log = stdout.push.bind(stdout);
    s3.stopWriting(function(err) {
        console.log = origlog;
        assert.ifError(err);
        assert.equal(stdout.length, 0, 'does not report');
        assert.end();
    });
});

tape('stopWriting (stats)', function(assert) {
    process.env.TILELIVE_S3_STATS = '1';
    var origlog = console.log;
    var stdout = [];
    console.log = stdout.push.bind(stdout);
    s3.stopWriting(function(err) {
        console.log = origlog;
        assert.ifError(err);
        assert.equal(stdout.length, 14, 'reports stats');
        delete process.env.TILELIVE_S3_STATS;
        assert.end();
    });
});

tape('puts a PBF tile', function(assert) {
    var pbf = fs.readFileSync(fixtures + '/tile.pbf.gz');
    vt.startWriting(function(err) {
        assert.ifError(err);
        vt.putTile(3, 6, 5, pbf, function(err) {
            assert.ifError(err);
            awss3.headObject({
                Bucket: 'mapbox',
                Key: 'tilelive-s3/vector/3/6/5.vector.pbf'
            }, function(err, res) {
                assert.ifError(err);
                assert.equal(res.ContentType, 'application/x-protobuf');
                assert.equal(res.ContentLength, '40115');
                assert.equal(res.ContentEncoding, 'gzip');
                assert.end();
            });
        });
    });
});

tape('should return a unique tile', function(assert) {
    nf.getTile(4, 12, 11, function(err, tile, headers) {
        if (err) throw err;
        assert.equal(1072, tile.length);
        assert.equal(headers['Content-Type'], 'image/png');
        assert.equal(headers['ETag'], '"2ba883e676e537d3da13e34d46e25044"');
        assert.end();
    });
});

tape('should return error tile', function(assert) {
    nf.getTile(0, 255, 255, function(err, tile, headers) {
        if (err) throw err;
        assert.equal(103, tile.length);
        assert.equal(headers['Content-Type'], 'image/png');
        assert.equal(headers['ETag'], '"1d6c3b07cc05d966d0029884fd4f58cc"');
        assert.end();
    });
});

tape('should not include custom keys', function(assert) {
    nf.getInfo(function(err, info) {
        if (err) throw err;
        assert.ok(!('awsKey' in info));
        assert.ok(!('awsSecret' in info));
        assert.ok(!('notFound' in info));
        assert.ok(!('maskLevel' in info));
        assert.ok(!('maskSolid' in info));
        assert.ok(!('maxSockets' in info));
        assert.ok(!('retry' in info));
        assert.end();
    });
});

var orig = {};
tape('setup', function(assert) {
    ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'].forEach(function(k) {
        orig[k] = process.env[k];
        delete process.env[k];
    });
    assert.end();
});

tape('should ignore data credentials', function(assert) {
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
        var creds = source.client.config.credentials;
        assert.notOk(creds.accessKeyId === 'DATAKEY');
        assert.end();
    });
});

tape('should ignore uri credentials', function(assert) {
    new S3({
        data: {
            tiles: [ "http://dummy-bucket.s3.amazonaws.com/test/{z}/{x}/{y}.png" ]
        },
        awsKey: "URIKEY",
        awsSecret: "URISECRET"
    }, function(err, source) {
        if (err) return done(err);
        var creds = source.client.config.credentials;
        assert.notOk(creds.accessKeyId === 'URIKEY');
        assert.end();
    });
});

tape('should use client passed in via uri', function(assert) {
    new S3({
        data: {
            tiles: [ "http://dummy-bucket.s3.amazonaws.com/test/{z}/{x}/{y}.png" ]
        },
        client: new AWS.S3({
            endpoint: 'http://localhost:20009'
        })
    }, function(err, source) {
        if (err) return done(err);
        assert.ok(!!source.client);
        assert.equal(source.client.config.endpoint, 'http://localhost:20009');
        assert.end();
    });
});

tape('cleanup', function(assert) {
    ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'].forEach(function(k) {
        process.env[k] = orig[k];
    });
    assert.end();
});

tape('source load error should fail gracefully', function(assert) {
    new S3({}, function(err, source) {
        assert.ok(err);
        assert.equal('Invalid URI', err.message);
        assert.end();
    });
});

(function() {

    var expected = {
        bounds: '-141.005548666451,41.6690855919108,-52.615930948992,83.1161164353916',
        lat: 56.8354595949484,
        lon: -110.424643384994,
        name: 'Canada',
        population: 33487208,
        search: 'Canada, CA'
    };

    var nogeocoder = new S3({data:JSON.parse(fs.readFileSync(__dirname + '/fixtures/vector.s3'))}, function() {});
    var from = new S3({data:JSON.parse(fs.readFileSync(__dirname + '/fixtures/geocoder.s3'))}, function() {});
    var prefixed = new S3({data:JSON.parse(fs.readFileSync(__dirname + '/fixtures/geocoder.prefixed.s3'))}, function() {});

    tape('getGeocoderData', function(assert) {
        from.getGeocoderData('term', 0, function(err, buffer) {
            assert.ifError(err);
            assert.equal(3891, buffer.length);
            assert.end();
        });
    });

    tape('getGeocoderData (prefixed source)', function(assert) {
        prefixed.getGeocoderData('term', 0, function(err, buffer) {
            assert.ifError(err);
            assert.equal(3891, buffer.length);
            assert.end();
        });
    });

    tape('getGeocoderData (no geocoder)', function(assert) {
        nogeocoder.getGeocoderData('term', 0, function(err, buffer) {
            assert.ifError(err);
            assert.equal(buffer, undefined);
            assert.end();
        });
    });

    tape.skip('putGeocoderData', function(assert) {
        to.startWriting(function(err) {
            assert.ifError(err);
            to.putGeocoderData('term', 0, new Buffer('asdf'), function(err) {
                assert.ifError(err);
                to.stopWriting(function(err) {
                    assert.ifError(err);
                    to.getGeocoderData('term', 0, function(err, buffer) {
                        assert.ifError(err);
                        assert.deepEqual('asdf', buffer.toString());
                        assert.end();
                    });
                });
            });
        });
    });

    tape('getIndexableDocs', function(assert) {
        from.getIndexableDocs({}, function(err, docs, pointer) {
            assert.ifError(err);
            assert.equal(docs.length, 63);
            assert.deepEqual(pointer, {shard:1});
            from.getIndexableDocs(pointer, function(err, docs, pointer) {
                assert.ifError(err);
                assert.equal(docs.length, 64);
                assert.deepEqual(pointer, {shard:2});
                assert.end();
            });
        });
    });

    tape('getIndexableDocs (prefixed source)', function(assert) {
        prefixed.getIndexableDocs({}, function(err, docs, pointer) {
            assert.ifError(err);
            assert.equal(docs.length, 63);
            assert.deepEqual(pointer, {shard:1});
            prefixed.getIndexableDocs(pointer, function(err, docs, pointer) {
                assert.ifError(err);
                assert.equal(64, docs.length);
                assert.equal(64, docs[0]._id);
                assert.deepEqual(pointer, {shard:2});
                prefixed.getIndexableDocs(pointer, function(err, docs, pointer) {
                    assert.ifError(err);
                    assert.equal(64, docs.length);
                    assert.equal(128, docs[0]._id);
                    assert.deepEqual(pointer, {shard:3});
                    assert.end();
                });
            });
        });
    });

})();

(function() {
    var source;
    var grid = fs.readFileSync(__dirname + '/fixtures/grid.json');

    tape('setup grid source', function(assert) {
        new S3({
            data: { grids: ['https://mapbox.s3.amazonaws.com/tilelive-s3/test/{z}/{x}/{y}.grid.json'] }
        }, function(err, src) {
            if (err) throw err;
            source = src;
            assert.end();
        });
    });

    tape('putGrid', function(assert) {
        source.putGrid(0, 0, 0, grid, function(err) {
            assert.ifError(err, 'success');
            assert.end();
        });
    });

    tape('getGrid', function(assert) {
        source.getGrid(0, 0, 0, function(err, data, headers) {
            assert.ifError(err, 'success');
            assert.equal(headers['Content-Type'], 'application/json', 'expected content type');
            assert.equal(headers.ETag, '"8de03081a763c624fad9f3271d990043"', 'expected ETag');
            assert.end();
        });
    });

    tape('get non-existent grid', function(assert) {
        source.getGrid(1, 1, 1, function(err, data, headers) {
            assert.equal(err.message, 'Grid does not exist');
            assert.end();
        });
    });
})();
