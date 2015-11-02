var util = require('util');
var split = require('split');
var s3scan = require('s3scan');
var s3urls = require('s3urls');
var StreamConcat = require('stream-concat');

module.exports = ZXYStream;
module.exports.config = config;

function ZXYStream(tilesUrl) {
    var conf = config(tilesUrl);
    var current = 0;
    return new StreamConcat(function() {
        if (!conf.toList[current]) return null;
        return s3scan.List(conf.toList[current++], {})
    }).pipe(split(function(line) {
        var matches = line.match(conf.tokenPattern);
        if (!matches || matches.length < 4) return undefined;
        return matches[conf.tokenMap[0]] + '/' +
            matches[conf.tokenMap[1]] + '/' +
            matches[conf.tokenMap[2]];
    }));
}

function config(tilesUrl) {
    var conf = {};
    conf.toList = [];
    if ((/{prefix}/).test(tilesUrl)) {
        for (var i = 0; i < 256; i++) {
            var prefix = i < 16 ? '0' + i.toString(16) : i.toString(16);
            conf.toList.push(s3urls.convert(tilesUrl, 's3').split(/{(z|x|y)}/)[0].replace(/{prefix}/g,prefix));
        }
    } else {
        conf.toList.push(s3urls.convert(tilesUrl, 's3').split(/{(z|x|y)}/)[0]);
    }

    var matches = s3urls.fromUrl(tilesUrl).Key.match(/{(z|x|y)}/g);
    if (matches.length !== 3) throw new Error('Could not find {z}, {x} and {y} tokens in url: ' + tilesUrl);

    conf.tokenMap = matches.reduce(function(memo, token, i) {
        if (token === '{z}') {
            memo[i] = 1;
        } else if (token === '{x}') {
            memo[i] = 2;
        } else if (token === '{y}') {
            memo[i] = 3;
        }
        return memo;
    }, []);

    conf.tokenPattern = new RegExp(s3urls.fromUrl(tilesUrl).Key
        .replace(/{prefix}/g, '[0-f]{2}')
        .replace(/{(z|x|y)}/g, '([0-9]+)'));

    return conf;
}

