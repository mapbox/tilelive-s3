var assert = require('assert');
var fs = require('fs');
var S3 = require('..');

var s3;
before(function(done) {
    new S3({
        pathname: './test/fixtures/test.s3',
    }, function(err, source) {
        if (err) return done(err);
        s3 = source;
        done();
    });
});

describe('info', function() {
    it('should not include custom keys', function(done) {
        s3.getInfo(function(err, info) {
            if (err) throw err;
            assert.ok(!('awsKey' in info));
            assert.ok(!('awsSecret' in info));
            assert.ok(!('maskLevel' in info));
            assert.ok(!('maskSolid' in info));
            assert.ok(!('maxSockets' in info));
            assert.ok(!('retry' in info));
            done();
        });
    });
});
