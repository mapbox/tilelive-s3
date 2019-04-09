tilelive-s3
-----------
Extends `node-tilejson` for using S3 as a tilejson backend.

```
npm install @mapbox/tilelive-s3
```

[![Build Status](https://travis-ci.org/mapbox/tilelive-s3.svg?branch=master)](https://travis-ci.org/mapbox/tilelive-s3)
[![Dependency Status](https://david-dm.org/mapbox/tilelive-s3.svg)](https://david-dm.org/mapbox/tilelive-s3)
[![codecov](https://codecov.io/gh/mapbox/tilelive-s3/branch/master/graph/badge.svg)](https://codecov.io/gh/mapbox/tilelive-s3)

 - pkg-config
 - libpng
 - node >= 0.10

Parameters
==========

Tilelive-S3's behaviour can be tweaked by passing through extra URL parameters. For example: `s3://mybucket/path?timeout=10000`

* `timeout`: sets the HTTP timeout in milliseconds (default 2000)
* `acl`: sets the AWS access control (default `private`). Choose `public-read` for publicly readable objects.
* `region`: sets the partition region (eg `cn-north-1`)
* `events`: if `true`, causes events to be emitted
* `sse`, `ssekmid`, `expires`, `cacheControl`: passed onto URI object

Tests
=====

Configure by setting the following environment variables.

```
AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN (optional)
```

Run `npm test`.
