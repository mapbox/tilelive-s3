// Set env key/secret before requiring tilelive-s3.
process.env.HOME = __dirname + '/fixtures';

var http = require('http');
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

var tmpid = +new Date();
var s3;
var vt;
var nf;

tape('setup', function(assert) {
    new S3({
        pathname: fixtures + '/test.s3'
    }, function(err, source) {
        assert.ifError(err);
        s3 = source;
        assert.end();
    });
});

tape('setup', function(assert) {
    new S3({
        pathname: fixtures + '/vector.s3'
    }, function(err, source) {
        assert.ifError(err);
        vt = source;
        assert.end();
    });
});

tape('setup', function(assert) {
    new S3({
        pathname: fixtures + '/notfound.s3',
        acl: 'public-read'
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

tape('marks source as open', function(assert) {
    var s = new S3(url.parse('s3://mapbox/tilelive-s3/test/{z}/{x}/{y}.png'), function(err, source) {
        assert.ifError(err, 'success');
        assert.equal(source.open, true);
        assert.end();
    });
});

tape('reads from uri.query', function(assert) {
    new S3(url.parse('s3://mapbox/tilelive-s3/test/{z}/{x}/{y}.png?acl=public-read&sse=aws:kms&sseKmsId=foo', true), function(err, source) {
        assert.ifError(err, 'success');
        assert.equal(source.acl, 'public-read', 'sets source.acl = public-read');
        assert.equal(source.sse, 'aws:kms', 'sets source.sse = aws:kms');
        assert.equal(source.sseKmsId, 'foo', 'sets source.sseKmsId = foo');
    });
    new S3(url.parse('s3://mapbox/tilelive-s3/test/{z}/{x}/{y}.acl png?acl=public-read&sse=aws:kms'), function(err, source) {
        assert.ifError(err, 'success');
        assert.equal(source.acl, 'public-read', 'sets source.acl = public-read');
        assert.equal(source.sse, 'aws:kms', 'sets source.sse = aws:kms');
    });
    new S3(url.parse('s3://mapbox/tilelive-s3/test/{z}/{x}/{y}.png?timeout=50000', true), function(err, source) {
        assert.ifError(err, 'success');
        assert.equal(source.client.config.httpOptions.timeout, 50000, 'sets source.timeout = 50000');
    });
    assert.end();
});

tape('invalid tiles key', function(assert) {
    new S3({
        data: { tiles: ['http://not-on-s3.com/clearly'] }
    }, function(err) {
        assert.ok(err, 'errors');
        assert.equal(err.message, 'tiles must exist on S3', 'expected error message');
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
        assert.equal(source.data.tiles[0], 'https://mapbox.s3.amazonaws.com/tilelive-s3/test/{z}/{x}/{y}.png');
        assert.equal(source.data.geocoder_data, 'https://mapbox.s3.amazonaws.com/tilelive-s3/test');
        if (err) return assert.end();
        source.getTile(4, 12, 11, function(err, tile, headers) {
            assert.ifError(err, 'got tile');
            if (err) return assert.end();
            assert.equal(1072, tile.length, 'got expected data');
            assert.end();
        });
    });
});

tape('setup source with querystring expires datestring', function(assert) {
    var expires = new Date('2020-01-01');
    new S3('s3://mapbox/tilelive-s3/test/{z}/{x}/{y}.png?expires=' + expires.toUTCString(), function(err, source) {
        assert.ifError(err, 'success');
        assert.equal(source.expires.toUTCString(), expires.toUTCString());
        assert.end();
    });
});

tape('setup source with querystring expires from timestamp', function(assert) {
    var expires = new Date('2020-01-01');
    new S3('s3://mapbox/tilelive-s3/test/{z}/{x}/{y}.png?expires=' + (+expires), function(err, source) {
        assert.ifError(err, 'success');
        assert.equal(source.expires.toUTCString(), expires.toUTCString());
        assert.end();
    });
});

tape('setup source ignores invalid expires', function(assert) {
    new S3('s3://mapbox/tilelive-s3/test/{z}/{x}/{y}.png?expires=asdfasdf', function(err, source) {
        assert.ifError(err, 'success');
        assert.equal(source.expires, undefined);
        assert.end();
    });
});

tape('setup source ignores invalid expires', function(assert) {
    new S3({
        data: { tiles: ['s3://mapbox/tilelive-s3/test/{z}/{x}/{y}.png'] },
        expires: 'asdfasdf'
    }, function(err, source) {
        assert.ifError(err, 'success');
        assert.equal(source.expires, undefined);
        assert.end();
    });
});

tape('should return a blank tile', function(assert) {
    s3.getTile(4, 12, 10, function(err) {
        assert.ok(err);
        assert.equal(err.message, 'Tile does not exist');
        assert.end();
    });
});

tape('should return a blank tile', function(assert) {
    s3.getTile(4, 12, 13, function(err, tile, headers) {
        assert.ok(err);
        assert.equal(err.message, 'Tile does not exist');
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

tape('should pass through unexpected errors', function(assert) {
    var mock = http.createServer(function(req, res) {
        res.statusCode = 418;
        res.end();
    }).listen(53202, function() {
        var s3 = new AWS.S3({
            endpoint: 'http://localhost:53202',
            s3BucketEndpoint: true
        });

        new S3({
            data: { tiles: ['http://fake.s3.amazonaws.com/{z}/{x}/{y}']},
            client: s3
        }, function(err, source) {
            if (err) throw err;

            source.getTile(0, 0, 0, function(err, data) {
                assert.equal(err.statusCode, 418)
                mock.close(function() {
                    assert.end();
                });
            });
        });
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
        Key: 'tilelive-s3/vector/3/6/5.vector.pbf'
    }, assert.end);
});

tape('setup', function(assert) {
    new S3('s3://mapbox/tilelive-s3/test-put/' + tmpid + '/{z}/{x}/{y}.png?acl=public-read&sse=AES256', function(err, source) {
        assert.ifError(err);
        s3 = source;
        assert.end();
    });
});

tape('setup', function(assert) {
    new S3('s3://mapbox/tilelive-s3/test-put/' + tmpid + '/{z}/{x}/{y}.vector.pbf', function(err, source) {
        assert.ifError(err);
        vt = source;
        assert.end();
    });
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
            Key: 'tilelive-s3/test-put/' + tmpid + '/3/6/5.png'
        }, function(err, res) {
            assert.ifError(err);
            assert.equal(res.ContentType, 'image/png');
            assert.equal(res.ContentLength, '827');
            assert.equal(res.ServerSideEncryption, 'AES256');
            acl();
        });
    }

    // Check ACL
    function acl() {
        awss3.getObjectAcl({
            Bucket: 'mapbox',
            Key: 'tilelive-s3/test-put/' + tmpid + '/3/6/5.png'
        }, function(err, res) {
            assert.ifError(err);
            assert.deepEqual(res.Grants[1], {
                Grantee: {
                    Type: 'Group',
                    URI: 'http://acs.amazonaws.com/groups/global/AllUsers'
                },
                Permission: 'READ'
            });
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
                Key: 'tilelive-s3/test-put/' + tmpid + '/3/6/5.vector.pbf'
            }, function(err, res) {
                assert.ifError(err);
                assert.equal(res.ContentType, 'application/x-protobuf');
                assert.equal(res.ContentLength, '40115');
                assert.equal(res.ContentEncoding, 'gzip');
                awss3.getObjectAcl({
                    Bucket: 'mapbox',
                    Key: 'tilelive-s3/test-put/' + tmpid + '/3/6/5.vector.pbf'
                }, function(err, res) {
                    assert.ifError(err);
                    assert.deepEqual(res.Grants.length, 1);
                    assert.end();
                });
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

tape('_prepareURL', function(assert) {
    assert.equal(s3._prepareURL('http://dummy-bucket.s3.amazonaws.com/test/{z}/{x}/{y}.png', 1, 2, 3), 'http://dummy-bucket.s3.amazonaws.com/test/1/2/3.png');
    assert.equal(s3._prepareURL('http://dummy-bucket.s3.amazonaws.com/{prefix}/test/{z}/{x}/{y}.png', 1, 164, 250), 'http://dummy-bucket.s3.amazonaws.com/4a/test/1/164/250.png');
    assert.equal(s3._prepareURL('http://dummy-bucket.s3.amazonaws.com/{prefix4}/test/{z}/{x}/{y}.png', 1, 164, 250), 'http://dummy-bucket.s3.amazonaws.com/a4fa/test/1/164/250.png');
    assert.equal(s3._prepareURL('http://dummy-bucket.s3.amazonaws.com/{prefix4}/test/{z}/{x}/{y}.png', 1, 15, 10), 'http://dummy-bucket.s3.amazonaws.com/0f0a/test/1/15/10.png', 'prefix for tile coordinates > 16 is padded');
    assert.equal(s3._prepareURL('http://dummy-bucket.s3.amazonaws.com/{prefix4}/test/{z}/{x}/{y}.png', 10, 268, 418), 'http://dummy-bucket.s3.amazonaws.com/0ca2/test/10/268/418.png', 'prefix for tile coordinates > 16 is padded');
    assert.end();
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

    tape('getGeocoderData (not found)', function(assert) {
        from.getGeocoderData('term', 1e9, function(err, buffer) {
            assert.ifError(err);
            assert.equal(buffer, undefined);
            assert.end();
        });
    });

    tape('putGeocoderData', function(assert) {
        var data = Math.random().toString();

        new S3('s3://mapbox/tilelive-s3/test/putGeocoderData/{z}/{x}/{y}', function(err, source) {
            assert.ifError(err);
            source.startWriting(function(err) {
                assert.ifError(err);
                afterSetup(source);
            });
        });

        function afterSetup(source) {
            source.putGeocoderData('term', 0, new Buffer(data), function(err) {
                assert.ifError(err);
                source.stopWriting(function(err) {
                    assert.ifError(err);
                    source.getGeocoderData('term', 0, function(err, buffer) {
                        assert.ifError(err);
                        assert.equal(data, buffer.toString());
                        assert.end();
                    });
                });
            });
        }
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
            assert.deepEqual(Object.keys(data), ['grid', 'keys', 'data'], 'grid has expected keys');
            assert.deepEqual(data.grid.length, 64, 'grid.data.length = 64');
            assert.deepEqual(data.keys.length, 121, 'grid.keys.length = 121');
            assert.deepEqual(Object.keys(data.data).length, 120, 'grid.data.length = 120');
            assert.equal(headers['Content-Type'], 'application/json', 'expected content type');
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

(function() {

var expires = new Date(+new Date + 864e5);

tape('expires PUT', function(assert) {
    new S3('s3://mapbox/tilelive-s3/test/expires/{z}/{x}/{y}.png?expires=' + encodeURIComponent(expires.toUTCString()), function(err, source) {
        assert.ifError(err);
        source.startWriting(function(err) {
            assert.ifError(err);
            source.putTile(0, 0, 0, fs.readFileSync(fixtures + '/tile.png'), function(err) {
                assert.ifError(err);
                assert.end();
            });
        });
    });
});

tape('expires GET', function(assert) {
    new S3('s3://mapbox/tilelive-s3/test/expires/{z}/{x}/{y}.png', function(err, source) {
        assert.ifError(err);
        source.getTile(0, 0, 0, function(err, data, headers) {
            assert.ifError(err);
            assert.equal(data.length, 827, 'gets tile data');
            assert.equal(headers['Expires'], expires.toUTCString(), 'has expires header');
            assert.end();
        });
    });
});

tape('expires cleanup', function(assert) {
    awss3.deleteObject({
        Bucket: 'mapbox',
        Key: 'tilelive-s3/test/expires/0/0/0.png'
    }, assert.end);
});

})();

tape('accepts region', function(assert) {
    assert.plan(2);
    var S3client = AWS.S3;
    AWS.S3 = function(params) {
        assert.equal(params.region, 'eu-central-1', 'S3 client with proper region');
    }

    new S3('s3://mapbox/tilelive-s3?region=eu-central-1', function(err) {
        assert.ifError(err, 'successfully created client');
        AWS.S3 = S3client;
    });
});

tape('accepts region in pre-parsed uri (qs.parsed)', function(assert) {
    assert.plan(2);
    var S3client = AWS.S3;
    AWS.S3 = function(params) {
        assert.equal(params.region, 'eu-central-1', 'S3 client with proper region');
    }

    new S3(url.parse('s3://mapbox/tilelive-s3?region=eu-central-1', true), function(err) {
        assert.ifError(err, 'successfully created client');
        AWS.S3 = S3client;
    });
});

tape('accepts region in pre-parsed uri (not qs.parsed)', function(assert) {
    assert.plan(2);
    var S3client = AWS.S3;
    AWS.S3 = function(params) {
        assert.equal(params.region, 'eu-central-1', 'S3 client with proper region');
    }

    new S3(url.parse('s3://mapbox/tilelive-s3?region=eu-central-1', false), function(err) {
        assert.ifError(err, 'successfully created client');
        AWS.S3 = S3client;
    });
});

tape('accepts region in tilejson', function(assert) {
    assert.plan(2);
    var S3client = AWS.S3;
    AWS.S3 = function(params) {
        assert.equal(params.region, 'eu-central-1', 'S3 client with proper region');
    }

    new S3({ data: { tiles: ['https://mapbox.s3.cn-north-1.amazonaws.com.cn/tilelive-s3?region=eu-central-1'] } }, function(err) {
        assert.ifError(err, 'successfully created client');
        AWS.S3 = S3client;
    });
});
