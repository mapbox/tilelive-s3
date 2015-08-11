var fs = require('fs');
var url = require('url');
var path = require('path');
var qs = require('querystring');
var binary = require('node-pre-gyp');
var binding_path = binary.find(path.resolve(path.join(__dirname,'../package.json')));
var decoder = require(binding_path);
var Buffer = require('buffer').Buffer;
var http = require('http');
var zlib = require('zlib');
var tiletype = require('tiletype');
var crypto = require('crypto');
var AWS = require('aws-sdk');
var AgentKeepAlive = require('agentkeepalive');
var s3urls = require('s3urls');
var utils = require('util');
var Emitter = require('events').EventEmitter;

module.exports = S3;

utils.inherits(S3, Emitter);
function S3(uri, callback) {
    this._uri = uri;
    this._cacheSolid;
    this._cacheNotFound;
    this._cacheMasks = {};
    this._stats = { get: 0, put: 0, noop: 0, txin: 0, txout: 0 };
    this._prepare = function(url) { return url };

    // If a uri of the form s3://[bucket]/[object] is passed,
    // generate implied HTTP resource and pass upstream for
    // retrieval to node-tilejson.

    if (uri.protocol === 's3:' && uri.host) {
        uri.host =
        uri.hostname = uri.host + '.s3.amazonaws.com';
        uri.protocol = 'https:';
        uri.data = {
            tiles: [url.format(uri)]
        };
    }

    var source = this;
    if (uri.data) { return setup(null, uri.data); }
    if (uri.pathname) return fs.readFile(uri.pathname, 'utf8', setup);
    callback(new Error('Invalid URI'));

    function setup(err, data) {
        source.data = typeof data === 'string' ? JSON.parse(data) : data;

        ['tiles', 'grids'].forEach(function(key) {
            if (!source.data[key] || !source.data[key].length) return;
            var hostname = url.parse(source.data[key][0]).hostname;
            if (hostname) source.bucket = source.bucket || hostname.split('.')[0];
        });

        if (source.data.mtime) source.mtime = new Date(source.data.mtime);
        if (source.data.prepare) source._prepare = Function('url,z,x,y', source.data.prepare);

        source.client = uri.client || new AWS.S3({
            maxRetries: 4,
            httpOptions: {
                timeout: 5000,
                agent: S3.agent
            }
        });

        source.emit('open', err, source);
        callback(err, source);
    }
};

S3.agent = new AgentKeepAlive.HttpsAgent({
    keepAlive: true,
    maxSockets: 16,
    keepAliveTimeout: 60000
});

function ManagedError(err) {
    if (!err) return false;

    var error, msg;
    if (err.name === 'TimeoutError') {
        error = new Error('Timed out after 5000ms');
        error.status = 504;
        error.retryable = false;
    } else if (err.statusCode === 404 || err.statusCode === 403) {
        error = new Error('Tile does not exist');
        error.status = err.statusCode;
        error.retryable = false;
    } else if (err.code === 'NetworkingError' && err.message === 'socket hang up') {
        error = new Error(err.message);
        error.status = 500;
        error.code = 'ECONNRESET';
        error.retryable = true;
    }

    if (!error) return false;
    Error.captureStackTrace(error, arguments.callee);
    return error;
}

function onRetry(res) {
    if (ManagedError(res.error)) res.error.retryable = ManagedError(res.error).retryable;
}

S3.registerProtocols = function(tilelive) {
    tilelive.protocols['s3:'] = S3;
};

S3.list = function(filepath, callback) {
    filepath = path.resolve(filepath);
    fs.readdir(filepath, function(err, files) {
        if (err && err.code === 'ENOENT') return callback(null, {});
        if (err) return callback(err);
        for (var result = {}, i = 0; i < files.length; i++) {
            var name = files[i].match(/^([\w-]+)\.s3$/);
            if (name) result[name[1]] = 's3://' + path.join(filepath, name[0]);
        }
        callback(null, result);
    });
};

S3.findID = function(filepath, id, callback) {
    filepath = path.resolve(filepath);
    var file = path.join(filepath, id + '.s3');
    fs.stat(file, function(err, stats) {
        if (err) callback(err);
        else callback(null, 's3://' + file);
    });
};

S3.prototype._prepareURL = function(url, z, x, y) {
    return (this._prepare(url,z,x,y)
        .replace(/\{prefix\}/g, (x%16).toString(16) + (y%16).toString(16))
        .replace(/\{z\}/g, z)
        .replace(/\{x\}/g, x)
        .replace(/\{y\}/g, (this.data.scheme === 'tms') ? (1 << z) - 1 - y : y));
};

S3.prototype.get = function(url, callback) {
    this.client.getObject(s3urls.fromUrl(url), function(err, response) {
        if (ManagedError(err)) return callback(ManagedError(err));
        if (err) return callback(err);

        callback(null, response.Body, {
            'content-type': response.ContentType,
            'content-length': response.ContentLength,
            'etag': response.ETag,
            'last-modified': response.LastModified,
            'cache-control': response.CacheControl
        });
    }).on('retry', onRetry);
};

S3.prototype._loadTile = function(z, x, y, callback) {
    if (!this.data) return callback(new Error('Tilesource not loaded'));
    if (!this.data.tiles) return callback(new Error('No "tiles" key'));

    var url = this._prepareURL(this.data.tiles[0], z, x, y);
    this.get(url, function(err, data, headers) {
        if (err) return callback(err);

        var modified = headers['last-modified'] ? new Date(headers['last-modified']) : new Date();
        var responseHeaders = tiletype.headers(data);
        responseHeaders['Last-Modified'] = modified;
        responseHeaders.ETag = headers.etag || (headers['content-length'] + '-' + (+modified));
        if (headers['cache-control']) {
            responseHeaders['Cache-Control'] = headers['cache-control'];
        }

        callback(null, data, responseHeaders);
    });
};

// Select a tile from S3. Scheme is XYZ.
S3.prototype.getTile = function(z, x, y, callback) {
    var s3 = this;
    var finalize = function(err, data, headers) {
        if (!err || err.message !== 'Tile does not exist' || !s3.data.notFound)
            return callback(err, data, headers);
        if (s3._cacheNotFound)
            return callback(null, s3._cacheNotFound.data, s3._cacheNotFound.headers);
        var z = s3.data.notFound[0];
        var x = s3.data.notFound[1];
        var y = s3.data.notFound[2];
        s3._loadTile(z, x, y, function(err, data, headers) {
            if (err) return callback(err);
            s3._cacheNotFound = { data: data, headers: headers };
            return callback(err, data, headers);
        });
    };
    if (this.data.format !== 'pbf' && this.data.maskLevel && z > this.data.maskLevel) {
        this._getColor(z, x, y, function(err, color) {
            if (err) {
                finalize(err);
            } else if (color === 255) {
                s3._getSolid(finalize);
            } else if (color === 0) {
                finalize(new Error('Tile does not exist'));
            } else {
                s3._loadTile(z, x, y, finalize);
            }
        });
    } else {
        this._loadTile(z, x, y, finalize);
    }
};

S3.prototype.getGrid = function(z, x, y, callback) {
    if (!this.data) return callback(new Error('Gridsource not loaded'));
    if (!this.data.grids) return callback(new Error('No "grids" key'));

    var url = this._prepareURL(this.data.grids[0], z, x, y);

    this.get(url, function(err, grid, headers) {
        if (err && (err.status === 404 || err.status === 403))
            err = new Error('Grid does not exist');
        if (err) return callback(err);

        var modified = headers['last-modified'] ? new Date(headers['last-modified']) : new Date();
        var responseHeaders = {
            'Content-Type': 'application/json',
            'Last-Modified': modified,
            'ETag': headers.etag || (headers['content-length'] + '-' + (+modified))
        };
        if (headers['cache-control']) {
            responseHeaders['Cache-Control'] = headers['cache-control'];
        }

        try {
            grid = grid.toString('utf8').replace(/^\s*\w+\s*\(|\)\s*;?\s*$/g, '');
            grid = JSON.parse(grid);
        } catch(jsonerr) {
            return callback(jsonerr);
        }
        return callback(null, grid, responseHeaders);
    });
};

S3.prototype._getSolid = function(callback) {
    if (this._cacheSolid) {
        var buffer = new Buffer(this._cacheSolid.data.length);
        this._cacheSolid.data.copy(buffer);
        return callback(null, buffer, this._cacheSolid.headers);
    }

    var s3 = this;
    var z = this.data.maskSolid[0];
    var x = this.data.maskSolid[1];
    var y = this.data.maskSolid[2];
    this._loadTile(z, x, y, function(err, data, headers) {
        if (err) return callback(err);
        s3._cacheSolid = { data: data, headers: headers };
        s3._getSolid(callback);
    });
};

// Calls callback with the alpha value or false of the tile.
S3.prototype._getColor = function(z, x, y, callback) {
    // Determine corresponding mask tile.
    var maskZ = this.data.maskLevel;
    var delta = z - maskZ;
    var maskX = x >> delta;
    var maskY = y >> delta;

    // Load mask tile.
    this._loadTileMask(maskZ, maskX, maskY, function(err, mask) {
        if (err) return callback(err);

        var size = 256 / (1 << delta);
        var minX = size * (x - (maskX << delta));
        var minY = size * (y - (maskY << delta));
        var maxX = minX + size;
        var maxY = minY + size;
        var pivot = mask[minY * 256 + minX];
        // Check that all alpha values in the ROI are identical. If they aren't,
        // we can't determine the color.
        for (var ys = minY; ys < maxY; ys++) {
            for (var xs = minX; xs < maxX; xs++) {
                if (mask[ys * 256 + xs] !== pivot) {
                    return callback(null, false);
                }
            }
        }

        callback(null, pivot);
    });
};

S3.prototype._loadTileMask = function(z, x, y, callback) {
    var key = z + ',' + x + ',' + y;
    if (this._cacheMasks[key])
        return callback(null, this._cacheMasks[key]);

    this._loadTile(z, x, y, function(err, buffer) {
        if (err) return callback(err);
        decoder.decode(buffer, function(err, mask) {
            if (err) return callback(err);
            // Store mask in cache. Reap cache if it grows beyond 1k objects.
            var keys = Object.keys(this._cacheMasks);
            if (keys.length > 1000) delete this._cacheMasks[keys[0]];
            this._cacheMasks[key] = mask;
            callback(null, mask);
        }.bind(this));
    }.bind(this));
};

// Inserts a grid into the S3 store. Scheme is XYZ.
S3.prototype.putGrid = function(z, x, y, data, callback) {
    this.gridPutPath = this.gridPutPath || (this.data.grids && this.data.grids[0] && url.parse(this.data.grids[0]).pathname.slice(1));
    if (!this.gridPutPath) return callback(new Error('No "grids" key'));

    data = new Buffer(JSON.stringify(data));
    var key = this._prepareURL(this.gridPutPath, z, x, y);
    var headers = {
        'x-amz-acl': 'public-read',
        'Connection': 'keep-alive',
        'Content-Length': data.length,
        'Content-Type': 'application/json'
    };
    this.put(key, data, headers, callback);
};

// Inserts a tile into the S3 store. Scheme is XYZ.
S3.prototype.putTile = function(z, x, y, data, callback) {
    this.putPath = this.putPath || (this.data.tiles && this.data.tiles[0] && url.parse(this.data.tiles[0]).pathname.slice(1));
    if (!this.putPath) return callback(new Error('No "tiles" key'));

    // Don't put solid tiles beyond maskLevel if using masking.
    if (data.key && data.key < 0 && this.data.maskLevel && z > this.data.maskLevel) {
        this._stats.noop++;
        return process.nextTick(function() { callback(); });
    }
    var key = this._prepareURL(this.putPath, z, x, y);
    var headers = tiletype.headers(data);
    headers['x-amz-acl'] = 'public-read';
    headers['Connection'] = 'keep-alive';
    headers['Content-Length'] = data.length;
    this.put(key, data, headers, callback);
};

// Generic PUT method for S3 keys. Handles conditional GETs and
// retries for failed requests.
S3.prototype.put = function(key, data, headers, callback) {
    if (!this.client) return callback(new Error('No S3 client found'));
    var stats = this._stats;
    var s3 = this.client;
    var params = {
        Bucket: this.bucket,
        Key: key
    };

    (function get() {
        var attempts = 5;
        stats.get++;

        var req = s3.getObject(params, function(err, response) {
            if (err && !ManagedError(err)) return callback(err);
            if (err && (err.statusCode === 404 || err.statusCode === 403)) return put();

            stats.txin += response.Body.length;
            var oldmd5 = crypto.createHash('md5').update(response.Body).digest('hex');
            var newmd5 = crypto.createHash('md5').update(data).digest('hex');

            if (oldmd5 === newmd5) {
                stats.noop++;
                return callback();
            }

            put();
        }).on('retry', onRetry);
    })();

    function put() {
        if (process.env.TILELIVE_S3_DRYRUN) {
            stats.put++;
            stats.txout += data.length;
            return callback();
        }

        params.Body = data;
        params.ACL = headers['x-amz-acl'];
        params.ContentType = headers['Content-Type'];

        s3.putObject(params, function(err, response) {
            if (ManagedError(err)) return callback(ManagedError(err));
            if (err && !err.message) return callback(new Error('S3 put failed: ' + err.statusCode + ' Unknown'));
            if (err) return callback(err);

            stats.put++;
            stats.txout += data.length;
            callback();
        }).on('retry', onRetry);
    }
};

S3.prototype.getInfo = function(callback) {
    if (!this.data) return callback(new Error('Tilesource not loaded'));

    var data = {};
    for (var key in this.data) switch (key) {
    // These keys are actually used.
    case 'notFound':
    case 'maskLevel':
    case 'maskSolid':
    // These keys are removed for legacy compatibility.
    case 'awsKey':
    case 'awsSecret':
    case 'maxSockets':
    case 'reportStats':
    case 'retry':
    case 'conditional':
    case 'dryrun':
        break;
    default:
        data[key] = this.data[key];
        break;
    }
    return callback(null, data);
};

// Insert/update metadata.
S3.prototype.putInfo = function(data, callback) {
    return callback();
};

// Enter write mode.
S3.prototype.startWriting = function(callback) {
    callback = callback || function() {};
    AWS.config.getCredentials(callback);
};

// Leave write mode.
S3.prototype.stopWriting = function(callback) {
    if (!process.env.TILELIVE_S3_STATS) return callback && callback();

    // @TODO let tilelive or tilemill expect a stats object
    // and process output instead.
    console.log('\n');
    if (process.env.TILELIVE_S3_DRYRUN) {
        console.log('Dryrun (no PUTs)');
        console.log('----------------');
    } else {
        console.log('S3 stats');
        console.log('--------');
    }
    console.log('GET:    %s', this._stats.get);
    console.log('PUT:    %s', this._stats.put);
    console.log('No-op:  %s', this._stats.noop);
    console.log('TX in:  %s', this._stats.txin);
    console.log('TX out: %s', this._stats.txout);
    console.log('');
    return callback && callback();
};

S3.prototype.toJSON = function() {
    return url.format(this._uri);
};

function prepareURI(uri, id) {
    var prefix = (id%256).toString(16);
    prefix = prefix.length < 2 ? '0' + prefix : prefix;
    uri = url.parse(uri);
    uri.pathname = uri.pathname.replace('{prefix}', prefix);
    return uri;
};

// Implements carmen#getGeocoderData method.
S3.prototype.getGeocoderData = function(type, shard, callback) {
    if (!this.data) return callback(new Error('Tilesource not loaded'));
    if (!this.data.geocoder_data) return callback();

    var extname = type === 'feature' ? '.json' : '.pbf';
    var source = this;

    // Parse carmen URL.
    try {
        var uri = prepareURI(this.data.geocoder_data, shard);
        uri.pathname = path.join(uri.pathname, type + '/' + shard + extname);
        this.get(url.format(uri), function(err, zdata) {
            if (err && err.status > 499) return callback(err);
            zlib.inflate(zdata, function(err, data) {
                if (err) return callback(err);
                callback(null, data);
            })
        });
    } catch (err) {
        return callback(new Error('Carmen not supported'));
    }
};

// Implements carmen#putGeocoderData method.
S3.prototype.putGeocoderData = function(type, shard, data, callback) {
    if (!this.data) return callback(new Error('Tilesource not loaded'));

    var source = this;
    var ctype = 'application/x-protobuf';
    var extname = '.pbf';
    if (type === 'feature') {
        ctype = 'application/json';
        extname = '.json';
    }

    // Parse carmen URL.
    try {
        var uri = prepareURI(this.data.geocoder_data, shard),
            key = path.join(uri.pathname, type + '/' + shard + extname),
            headers = {
                'x-amz-acl': 'public-read',
                'Connection': 'keep-alive',
                'Content-Encoding': 'deflate',
                'Content-Type': ctype
            };
        zlib.deflate(data, function(err, zdata) {
            if (err) return callback(err);
            headers['Content-Length'] = zdata.length;
            source.put(key, zdata, headers, callback);
        });
    } catch (err) {
        return callback(new Error('Carmen not supported'));
    }
};

// Implements carmen#getIndexableDocs method.
S3.prototype.getIndexableDocs = function(pointer, callback) {
    if (!this.data) return callback(new Error('Tilesource not loaded'));

    pointer = pointer || {};
    pointer.shard = pointer.shard || 0;

    var shardlevel = (this.data.geocoder_shardlevel || 0) + 1;
    var limit = Math.pow(16, shardlevel);

    // All shards have been read. Done.
    if (pointer.shard >= limit) return callback(null, [], pointer);

    this.getGeocoderData('feature', pointer.shard, function(err, buffer) {
        if (err) return callback(err);
        var data = buffer ? JSON.parse(buffer) : {};
        var docs = [];
        for (var a in data) {
            var features = JSON.parse(data[a]);
            for (var b in features) {
                docs.push(features[b]);
            }
        }
        pointer.shard++;
        callback(null, docs, pointer);
    });
};
