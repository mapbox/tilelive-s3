var fs = require('fs');
var url = require('url');
var path = require('path');
var qs = require('querystring');
var Buffer = require('buffer').Buffer;
var http = require('http');
var zlib = require('zlib');
var tiletype = require('@mapbox/tiletype');
var crypto = require('crypto');
var AWS = require('aws-sdk');
var AgentKeepAlive = require('agentkeepalive');
var s3urls = require('@mapbox/s3urls');
var utils = require('util');
var Emitter = require('events').EventEmitter;
var url = require('url');

module.exports = S3;

var immediate = global.setImmediate || process.nextTick;

var defaultAgent = new AgentKeepAlive.HttpsAgent({
    keepAlive: true,
    maxSockets: 128,
    keepAliveTimeout: 60000
});

if (process.env.AWS_S3_ENDPOINT) {
    var protocol = url.parse(process.env.AWS_S3_ENDPOINT).protocol;
    if (protocol === 'http:') {
        defaultAgent = new AgentKeepAlive({
            keepAlive: true,
            maxSockets: 128,
            keepAliveTimeout: 60000
        });
    }
}

utils.inherits(S3, Emitter);
function S3(uri, callback) {
    if (typeof uri === 'string') uri = url.parse(uri);
    this._uri = uri;
    this._cacheSolid;
    this._cacheNotFound;
    this._cacheMasks = {};
    this._stats = { get: 0, put: 0, noop: 0, blocked: 0, txin: 0, txout: 0 };
    this._prepare = function(url) { return url };

    // If a parsed uri of the form s3://[bucket]/[path template] is passed,
    // assume that tiles are implied (no grids), and generate a data
    // object containing an https://[bucket].s3.amazonaws.com/[path template]
    // tiles key.

    if (uri.protocol === 's3:' && uri.host) {
        uri.host =
        uri.hostname = uri.host + '.s3.amazonaws.com';
        uri.protocol = 'https:';

        // for node v0.12+ which encodes URI components token placeholders {z}
        // when the uri is parsed.
        var templateURL = decodeURIComponent(url.format(uri));
        uri.data = {
            tiles: [ templateURL ],
            geocoder_data: templateURL.substr(0, templateURL.indexOf('/{z}/{x}/{y}'))
        };

        var query = typeof uri.query === 'string' ? qs.parse(uri.query) : (uri.query || {});
        if (query && query.region === 'cn-north-1') {
            uri.host =
            uri.hostname = 's3.cn-north-1.amazonaws.com.cn';
        };
        uri.acl = query.acl || 'private';
        uri.sse = query.sse;
        uri.sseKmsId = query.sseKmsId;

        this._eventsEnabled = (query.events && query.events === 'true') || false;

        if (query.timeout && /^[0-9]+$/.test(query.timeout)) {
            uri.timeout = parseInt(query.timeout);
        }
        if (query.expires && /^[0-9]+$/.test(query.expires)) {
            uri.expires = parseInt(query.expires, 10);
        } else if (query.expires) {
            uri.expires = query.expires;
        }

        if (query.cacheControl) uri.cacheControl = query.cacheControl;
    }

    var source = this;
    if (uri.data) { return setup(null, uri.data); }
    if (uri.pathname) return fs.readFile(uri.pathname, 'utf8', setup);
    callback(new Error('Invalid URI'));

    function setup(err, data) {
        if (err) return callback(err);

        source.data = typeof data === 'string' ? JSON.parse(data) : data;

        ['tiles', 'grids'].forEach(function(key) {
            if (!source.data[key] || !source.data[key].length) return;
            var params = s3urls.fromUrl(source.data[key][0]);
            if (!params.Bucket || !params.Key) err = new Error(key + ' must exist on S3');
            if (source.bucket && params.Bucket !== source.bucket) err = new Error('buckets for tiles and grids must match');
            source.bucket = params.Bucket;

            var query = url.parse(source.data[key][0], true).query;
            if (!query.region) return;
            if (source.region && query.region !== source.region) err = new Error('buckets for tiles and grids must be in the same region');
            source.region = query.region;
        });

        source.client = uri.client || new AWS.S3({
            s3ForcePathStyle: !!process.env.AWS_S3_ENDPOINT || AWS.config.s3ForcePathStyle,
            region: source.region,
            endpoint: process.env.AWS_S3_ENDPOINT,
            maxRetries: 4,
            httpOptions: {
                timeout: 2000,
                agent: defaultAgent
            }
        });

        if (source.data.mtime) source.mtime = new Date(source.data.mtime);
        if (source.data.prepare) source._prepare = Function('url,z,x,y', source.data.prepare);

        source.acl = uri.acl || 'public-read';
        source.sse = uri.sse;
        source.sseKmsId = uri.sseKmsId;
        source.expires = uri.expires && !isNaN(+new Date(uri.expires)) ? new Date(uri.expires) : undefined;
        if (uri.cacheControl) {
            source.cacheControl = uri.cacheControl.replace(/'|"/g, '');
        }
        if (uri.timeout) source.client.config.httpOptions.timeout = uri.timeout;
        if (uri.strict && uri.strict === true) source.strict = true;

        source.open = true;
        source.emit('open', err, source);
        if (err) return callback(err);
        callback(null, source);
    }
};

function managedError(err, context, grid) {
    if (!err) return false;

    // If call context was passed from AWS SDK we may have access to the
    // httpResponse headers to attach an x-amz-request-id. Attempt to do so.
    if (context &&
        context.httpResponse &&
        context.httpResponse.headers) {
        if (context.httpResponse.headers['x-amz-request-id']) {
            err.amzRequestId = context.httpResponse.headers['x-amz-request-id'];
        }
        if (context.httpResponse.headers['x-amz-id-2']) {
            err.amzId2 = context.httpResponse.headers['x-amz-id-2'];
        }
    }

    var error, msg;
    if (err.name === 'TimeoutError') {
        if (err.message) msg = err.message;
        error = new Error(msg || "Timed out");
        error.statusCode = 504;
        error.retryable = true;
    } else if (err.statusCode === 404 || err.statusCode === 403) {
        error = new Error(grid ? 'Grid does not exist' : 'Tile does not exist');
        error.statusCode = err.statusCode;
        error.retryable = false;
    } else if (err.code === 'NetworkingError' && err.message === 'socket hang up') {
        error = new Error(err.message);
        error.statusCode = 500;
        error.code = 'ECONNRESET';
        error.retryable = true;
    } else if (err.code === 'InternalError') {
        error = new Error(err.message);
        error.statusCode = 500;
        error.code = 'InternalError';
        error.retryable = true;
    } else if (err.code === 'TruncatedResponseError') {
        // This error is generated by tilelive-s3 -- it is not recognized as an
        // error by aws-sdk. See S3.get below.
        error = new Error('Content-Length does not match response body length');
        error.statusCode = 500;
        error.code = 'TruncatedResponseError',
        error.retryable = true;
    } else if (err.statusCode === 503 && !err.message) {
        error = new Error('503 Unknown');
        error.statusCode = 503;
        error.retryable = true;
    }

    if (!error) return false;

    if (error.statusCode >= 500 && err.amzRequestId) {
        error.message = '[x-amz-request-id:' + err.amzRequestId + '] ' + error.message;
        error.amzRequestId = err.amzRequestId;
    }

    if (error.statusCode >= 500 && err.amzId2) {
        error.message = '[x-amz-id-2:' + err.amzId2 + '] ' + error.message;
        error.amzId2 = err.amzId2;
    }

    Error.captureStackTrace(error, arguments.callee);
    return error;
}

function onRetry(res) {
    if (managedError(res.error, res)) res.error.retryable = managedError(res.error, res).retryable;
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
    function pad(str) {
        return str.length < 2 ? '0' + str : str;
    }
    return (this._prepare(url,z,x,y)
        .replace(/\{prefix\}/g, (x % 16).toString(16) + (y % 16).toString(16))
        .replace(/\{prefix4\}/g, pad((x % 256).toString(16)) + pad((y % 256).toString(16)))
        .replace(/\{z\}/g, z)
        .replace(/\{x\}/g, x)
        .replace(/\{y\}/g, (this.data.scheme === 'tms') ? (1 << z) - 1 - y : y));
};

S3.prototype.get = function(url, callback) {
    this.client.getObject(s3urls.fromUrl(url), function(err, response) {
        if (err) return callback(err);

        callback(null, response.Body, {
            'content-type': response.ContentType,
            'content-length': response.ContentLength,
            'etag': response.ETag,
            'last-modified': response.LastModified,
            'cache-control': response.CacheControl,
            'expires': S3.futurize(response.Expires)
        });
    })
    .on('retry', onRetry)
    .on('extractData', function(res) {
        if (res.data.Body.length != res.data.ContentLength) {
            res.data = null;
            res.error = {
                code: 'TruncatedResponseError',
                message: 'Content-Length does not match response body length'
            };
        }
    });
};

S3.prototype._loadTile = function(z, x, y, callback) {
    if (!this.data) return callback(new Error('Tilesource not loaded'));
    if (!this.data.tiles) return callback(new Error('No "tiles" key'));
    if (this.strict) {
      if (z < this.data.minzoom || z > this.data.maxzoom) return callback(new Error('Tile does not exist'));
    }

    var url = this._prepareURL(this.data.tiles[0], z, x, y);
    this.get(url, function(err, data, headers) {
        if (err) return callback(managedError(err, this) || err);

        var modified = headers['last-modified'] ? new Date(headers['last-modified']) : new Date();
        var responseHeaders = tiletype.headers(data);
        responseHeaders['Last-Modified'] = modified;
        responseHeaders.ETag = headers.etag || (headers['content-length'] + '-' + (+modified));
        if (headers['cache-control']) {
            responseHeaders['Cache-Control'] = headers['cache-control'];
        }
        if (headers['expires']) {
            responseHeaders['Expires'] = headers['expires'];
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
    this._loadTile(z, x, y, finalize);
};

S3.prototype.getGrid = function(z, x, y, callback) {
    if (!this.data) return callback(new Error('Gridsource not loaded'));
    if (!this.data.grids) return callback(new Error('Grid does not exist'));

    var url = this._prepareURL(this.data.grids[0], z, x, y);

    this.get(url, function(err, grid, headers) {
        if (err) return callback(managedError(err, this, true) || err);

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
            grid = JSON.parse(grid);
        } catch(jsonerr) {
            return callback(jsonerr);
        }
        return callback(null, grid, responseHeaders);
    });
};

// Inserts a grid into the S3 store. Scheme is XYZ.
S3.prototype.putGrid = function(z, x, y, data, callback) {
    if (!this.data.grids || !this.data.grids.length) return callback(new Error('No "grids" key'));

    var key = url.parse(this._prepareURL(this.data.grids[0], z, x, y)).pathname.slice(1);
    var headers = {
        'x-amz-acl': this.acl,
        'x-amz-server-side-encryption': this.sse,
        'x-amz-server-side-encryption-aws-kms-key-id': this.sseKmsId,
        'Connection': 'keep-alive',
        'Content-Type': 'application/json'
    };
    this.put(key, data, headers, callback);
};

// Inserts a tile into the S3 store. Scheme is XYZ.
S3.prototype.putTile = function(z, x, y, data, callback) {
    if (!this.data.tiles || !this.data.tiles.length) return callback(new Error('No "tiles" key'));

    // Don't put solid tiles beyond fillzoom.
    if (data.key && data.key < 0 && this.data.fillzoom && z > this.data.fillzoom) {
        this._stats.noop++;
        return immediate(function() { callback(); });
    }
    var source = this;
    var key = url.parse(this._prepareURL(this.data.tiles[0], z, x, y)).pathname.slice(1);
    var headers = tiletype.headers(data);
    headers['x-amz-acl'] = this.acl;
    headers['x-amz-server-side-encryption'] = this.sse;
    headers['x-amz-server-side-encryption-aws-kms-key-id'] = this.sseKmsId;
    headers['Connection'] = 'keep-alive';
    headers['Content-Length'] = data.length;
    if (this.cacheControl) headers['Cache-Control'] = this.cacheControl;
    if (this.expires) headers['Expires'] = this.expires;
    this.put(key, data, headers, function (err) {
        if (!err && source._eventsEnabled) source.emit('putTile', z, x, y, data.length);
        callback(err);
    });
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
            if (err) return put();

            stats.txin += response.Body.length;
            var oldmd5 = crypto.createHash('md5').update(response.Body).digest('hex');
            var newmd5 = crypto.createHash('md5').update(data).digest('hex');

            if (oldmd5 === newmd5) {
                stats.noop++;
                return callback();
            }

            // Block suspicious tiles from overwriting existing data
            if (data.length <= response.Body.length * 0.5) {
              stats.blocked++;
              params.Key += '.blocked';
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
        if (headers['x-amz-server-side-encryption']) params.ServerSideEncryption = headers['x-amz-server-side-encryption'];
        if (headers['x-amz-server-side-encryption-aws-kms-key-id']) params.SSEKMSKeyId = headers['x-amz-server-side-encryption-aws-kms-key-id'];
        params.ContentType = headers['Content-Type'];
        if (headers['Expires']) params.Expires = headers['Expires'];
        if (headers['Cache-Control']) params.CacheControl = headers['Cache-Control'];
        if (headers['Content-Encoding']) params.ContentEncoding = headers['Content-Encoding'];

        s3.putObject(params, function(err, response) {
            if (err) return callback(managedError(err, this) || err);

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
    console.log('GET:     %s', this._stats.get);
    console.log('PUT:     %s', this._stats.put);
    console.log('No-op:   %s', this._stats.noop);
    console.log('Blocked: %s', this._stats.blocked);
    console.log('TX in:   %s', this._stats.txin);
    console.log('TX out:  %s', this._stats.txout);
    console.log('');
    return callback && callback();
};

S3.prototype.toJSON = function() {
    return url.format(this._uri);
};

function prepareURI(uri, id) {
    var prefix = (id%256).toString(16);
    prefix = prefix.length < 2 ? '0' + prefix : prefix;
    uri = url.parse(uri.replace('{prefix}', prefix));
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
            if (err) {
                err = managedError(err, this) || err;
                if (err.statusCode === 404 || err.statusCode === 403) {
                    return callback();
                } else {
                    return callback(err);
                }
            }
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
            key = path.join(uri.pathname.slice(1), type + '/' + shard + extname),
            headers = {
                'x-amz-acl': source.acl,
                'x-amz-server-side-encryption': source.sse,
                'x-amz-server-side-encryption-aws-kms-key-id': source.sseKmsId,
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

// Ensure an Expires header is set in the future at the nearest +60s
// interval from the original Expires time.
S3.futurize = function(expires) {
    if (!expires) return undefined;
    now = new Date(Math.ceil(+new Date/1e3)*1e3);
    expires = new Date(expires);
    if (expires > now) {
        return expires.toUTCString();
    } else {
        // Add N minutes
        var extraMinutes = Math.ceil((now - Number(expires))/60e3) * 60e3;
        return (new Date(Number(expires) + extraMinutes)).toUTCString();
    }
};
