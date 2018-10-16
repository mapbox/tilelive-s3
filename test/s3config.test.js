var tape = require('tape');
var path = require('path');
var fs = require('fs');
var S3 = require('../lib');
var crypto = require('crypto');
var AWS = require('aws-sdk');
var url = require('url');

tape('configure s3 client', function(assert) {
    delete process.env.AWS_S3_ENDPOINT;
    delete AWS.config.s3ForcePathStyle;
    new S3(url.parse('s3://mapbox/tilelive-s3/test/{z}/{x}/{y}.png'), function(err, source) {
        assert.ifError(err);
        assert.deepEqual(source.client.config.s3ForcePathStyle, false);
        assert.end();
    });
});

tape('configure s3 client (global config)', function(assert) {
    delete process.env.AWS_S3_ENDPOINT;
    AWS.config.s3ForcePathStyle = true;
    new S3(url.parse('s3://mapbox/tilelive-s3/test/{z}/{x}/{y}.png'), function(err, source) {
        assert.ifError(err);
        assert.deepEqual(source.client.config.s3ForcePathStyle, true, 'respects global config');
        assert.end();
    });
});

tape('configure s3 client (custom endpoint)', function(assert) {
    process.env.AWS_S3_ENDPOINT = 'http://localhost';
    AWS.config.s3ForcePathStyle = false;
    new S3(url.parse('s3://mapbox/tilelive-s3/test/{z}/{x}/{y}.png'), function(err, source) {
        assert.ifError(err);
        assert.deepEqual(source.client.config.s3ForcePathStyle, true, 'custom endpoint overrides global config');
        assert.end();
    });
});

