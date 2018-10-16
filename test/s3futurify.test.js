var tape = require('tape');
var S3 = require('../lib/index.js');

tape('futurize', function(assert) {
    assert.deepEqual(S3.futurize(0), undefined, 'no-op on 0');
    assert.deepEqual(S3.futurize(null), undefined, 'no-op on null');
    assert.deepEqual(S3.futurize(false), undefined, 'no-op on false');
    assert.deepEqual(S3.futurize(undefined), undefined, 'no-op on undefined');

    var expires, now;

    expires = new Date(+new Date + 1e3);
    assert.deepEqual(S3.futurize(expires), expires.toUTCString(), 'passthrough on future expires');

    expires = new Date(+new Date - 10e3);
    assert.deepEqual(S3.futurize(expires), (new Date(Number(expires) + 60e3)).toUTCString(), 'bumps past expires up to nearest +60s time in the future');

    expires = new Date(+new Date - 70e3);
    assert.deepEqual(S3.futurize(expires), (new Date(Number(expires) + 120e3)).toUTCString(), 'bumps past expires up to nearest +60s time in the future');

    expires = new Date(+new Date - 90e3);
    assert.deepEqual(S3.futurize(expires), (new Date(Number(expires) + 120e3)).toUTCString(), 'bumps past expires up to nearest +60s time in the future');

    // fuzz test
    var pass = true;
    for (var i = 0; i < 10000; i++) {
        expires = new Date(+new Date - Math.floor(Math.random() * 864e5));
        now = new Date();
        if (expires > now) {
            assert.fail('expires not in the past');
            pass = false;
        }
        if (new Date(S3.futurize(expires)) <= now) {
            assert.fail('futurize puts expires in the future: ' + new Date(S3.futurize(expires)) + ' vs ' + new Date(now));
            pass = false;
        }
        if (new Date(S3.futurize(expires)) > (+now + 60e3)) {
            assert.fail('but <= 60s into the future');
            pass = false;
        }
    }
    assert.ok(pass, 'fuzz x10000');

    assert.end();
});
