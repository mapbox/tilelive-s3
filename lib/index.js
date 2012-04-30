var fs = require('fs');
var url = require('url');
var path = require('path');
var qs = require('querystring');
var decoder = require('./decoder.node');
var Buffer = require('buffer').Buffer;
var knox = require('knox');
var http = require('http');
var TileJSON = require('tilejson');
var crypto = require('crypto');

module.exports = S3;
require('util').inherits(S3, TileJSON);
function S3(uri, callback) {
    this._uri = uri;
    this._cacheSolid;
    this._cacheMasks = {};
    this._stats = { get: 0, put: 0, noop: 0 };
    return TileJSON.call(this, uri, function(err, source) {
        // Increase number of connections that can be made to S3.
        // Can be specified manually in data for cases where ulimit
        // has been pushed higher.
        // @TODO consider using node-posix to determine the best value here.
        // @TODO this may belong upstream in node-tilejson.
        if (source && source.data) ['tiles', 'grids'].forEach(function(key) {
            if (!source.data[key] || !source.data[key].length) return;
            var hostname = url.parse(source.data[key][0]).hostname;
            var agent = http.globalAgent || http.getAgent(hostname, '80');
            agent.maxSockets = source.data.maxSockets || 128;
        });
        callback(err, source);
    });
};

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
    return (url
        .replace(/\{prefix\}/g, (x%16).toString(16) + (y%16).toString(16))
        .replace(/\{z\}/g, z)
        .replace(/\{x\}/g, x)
        .replace(/\{y\}/g, (this.data.scheme === 'tms') ? (1 << z) - 1 - y : y));
};

S3.prototype._loadTile = TileJSON.prototype.getTile;

// Select a tile from S3. Scheme is XYZ.
S3.prototype.getTile = function(z, x, y, callback) {
    var s3 = this;
    if (this.data.maskLevel && z > this.data.maskLevel) {
        this._getColor(z, x, y, function(err, color) {
            if (err) {
                callback(err);
            } else if (color === 255) {
                s3._getSolid(callback);
            } else if (color === 0) {
                callback(new Error('Tile does not exist'));
            } else {
                s3._loadTile(z, x, y, callback);
            }
        });
    } else {
        this._loadTile(z, x, y, callback);
    }
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

// Inserts a tile into the S3 store. Scheme is XYZ.
S3.prototype.putTile = function(z, x, y, data, callback) {
    // Solid tiles.
    // Don't put tiles beyond maskLevel if using masking.
    if (data.key &&
        data.key < 0 &&
        this.data.maskLevel &&
        z > this.data.maskLevel) {
        this._stats.noop++;
        return process.nextTick(function() { callback(); });
    }

    var stats = this._stats;

    var error = function(err) {
        if (!err) return callback();
        if (this.data.retry) {
            setTimeout(function() {
                this.putTile(z, x, y, data, callback);
            }.bind(this), 10000);
        } else {
            callback(err);
        }
    }.bind(this);

    var put = function() {
        // Skip PUT if dryrun.
        if (this.data.dryrun) {
            stats.put++;
            return callback();
        }
        var req = this.client.put(this._prepareURL(this.putPath, z, x, y), {
            'Content-Length': data.length,
            'Content-Type': 'image/png'
        });
        req.on('close', error);
        req.on('error', error);
        req.on('response', function(res) {
            if (res.statusCode === 200) {
                stats.put++;
                return callback();
            }
            return error(new Error('S3 put failed: ' + res.statusCode));
        });
        req.end(data);
    }.bind(this);

    if (this.data.conditional) return this.getTile(z, x, y, function(err, buffer, headers) {
        stats.get++;
        // Error.
        if (err && err.message !== 'Tile does not exist' && err.status !== 403) return error(err);
        // Tile is not on s3 yet. Put it.
        if (err) return put();
        // Compare old tile buffer with new. If same, skip PUT.
        var oldmd5 = crypto.createHash('md5').update(buffer).digest('hex');
        var newmd5 = crypto.createHash('md5').update(data).digest('hex');
        if (oldmd5 === newmd5) {
            stats.noop++;
            return callback();
        }
        // Old tile buffer does not match new. PUT.
        return put();
    });
    else return put();
};

S3.prototype.getInfo = function(callback) {
    if (!this.data) return callback(new Error('Tilesource not loaded'));

    var data = {};
    for (var key in this.data) switch (key) {
    case 'awsKey':
    case 'awsSecret':
    case 'maskLevel':
    case 'maskSolid':
    case 'maxSockets':
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
    if (!this.data.awsKey) return callback(new Error('AWS key required.'));
    if (!this.data.awsSecret) return callback(new Error('AWS secret required.'));
    if (this.data.dryrun) console.log('Dryrun enabled. No data will be PUT to S3.');

    this.uri = url.parse(this.data.tiles[0]);
    this.putPath = this.uri.pathname;
    this.client = knox.createClient({
        key: this.data.awsKey,
        secret: this.data.awsSecret,
        bucket: this.uri.hostname.split('.')[0]
    });

    return callback();
};

// Leave write mode.
S3.prototype.stopWriting = function(callback) {
    // @TODO let tilelive or tilemill expect a stats object
    // and process output instead.
    console.log('\n');
    console.log('S3 stats');
    console.log('--------');
    console.log('GET:   %s', this._stats.get);
    console.log('PUT:   %s', this._stats.put);
    console.log('No-op: %s', this._stats.noop);
    console.log('');
    return callback();
};

S3.prototype.toJSON = function() {
    return url.format(this._uri);
};

