var tape = require('tape');
var S3 = require('..');
var path = require('path');
var http = require('http');
var AWS = require('aws-sdk');
var hat = require('hat');
var fixtures = path.resolve(__dirname + '/fixtures');
var s3;

var mock = http.createServer(function (req, res) {
    if (req.method == 'GET' && req.url === '/latest/meta-data/iam/security-credentials/') {
        res.writeHead(200);
        res.end('roleid');
    } else if (req.method == 'GET' && req.url === '/latest/meta-data/iam/security-credentials/roleid') {
        res.writeHead(200);
        res.end(JSON.stringify({
            Code: "Success",
            LastUpdated: "2012-04-26T16:39:16Z",
            Type: "AWS-HMAC",
            AccessKeyId: hat(),
            SecretAccessKey: hat(),
            Token: hat(),
            Expiration: (new Date(Date.now() + 10000)).toISOString()
        }));
    } else {
        res.writeHead(404);
        res.end();
    }
}).listen(20010, '127.0.0.1');

tape('setup', function(assert) {
    new S3({
        pathname: fixtures + '/test.s3',
    }, function(err, source) {
        assert.ifError(err);
        s3 = source;
        assert.end();
    });
});

tape('refreshCreds', function(assert) {
    var provider = new AWS.EC2MetadataCredentials({
        host: 'localhost:20010'
    });

    var defaultProviders = AWS.CredentialProviderChain.defaultProviders;
    AWS.CredentialProviderChain.defaultProviders = [provider];

    s3.startWriting(function(err) {
        var initial = {};
        initial.key = s3.client.key;
        initial.secret = s3.client.secret;
        initial.token = s3.client.token;
        s3.refreshCreds(function(err) {
            assert.notEqual(initial.key, s3.client.key);
            assert.notEqual(initial.secret, s3.client.secret);
            assert.notEqual(initial.token, s3.client.token);
            AWS.CredentialProviderChain.defaultProviders = defaultProviders;
            assert.end();
        });
    });
});

tape('mock server teardown', function(assert) {
    mock.close(assert.end);
});
