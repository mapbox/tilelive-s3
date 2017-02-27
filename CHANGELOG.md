## 6.5.0

- Optional `strict` property will short-circuit requests to S3 if a tile is below a minzoom or above a maxzoom. This cuts down on actually doing it for requests that are known 404s. [#89](https://github.com/mapbox/tilelive-s3/pull/89)
- move to @mapbox/tilelive-s3 namespace

## 6.4.3

- Adds S3 endpoint for cn-north-1 query region

## 6.4.2

- Allows caller to set a region when providing tile URLs via a tilejson object
- Upgrades s3urls to support buckets in cn-north-1

## 6.4.1

- Allows caller to set a region when providing a pre-parsed uri object

## 6.4.0

- Allow caller to set the appropriate S3 region for the destination bucket via `region` query param

## 6.3.0

- Allow override of default S3 timeout via `timeout` query param

## 6.2.0

- Adds support for an environment variable `AWS_S3_ENDPOINT` which can be useful in testing scenarios

## 6.1.0

- Add support for `{prefix4}` hex prefix scheme

## 6.0.0

- Move the S3 client up into global scope
- S3.timeout and S3.agent are no longer configurable

## 5.0.0

- Default setting for `acl` is now `private`. Explicitly set `public-read` for
  compatibility.
- Add support for S3 server-side encryption.

## 4.1.1

* Fix inaccurate timeout error message

## 4.1.0

* Exposes `S3.timeout` property for overriding default S3 timeout of 5000ms

## 4.0.0

* Removed all cpp + color masking code.
* Renamed `maskLevel` to `fillzoom`.

## 3.2.3

* Republished.

## 3.2.2

* Additional fixes for carmen integration.

## 3.2.1

* Robustify `putTile` and `put` behavior against intermittent unmanaged S3 GET errors

## 3.2.0

* Add optional support for `expires` header when putting tiles

## 3.1.2

* Fixes for carmen integration.

## 3.1.1

* Reimplement `source.open` property that was lost when uninheriting from `node-tilejson`

## 3.1.0

* Expose `x-amz-request-id` and `x-amz-id-2` via error objects on 5xx requests

## 3.0.0

* Use err.statusCode only

## 2.0.1

* increase socket pool to 128

## 2.0.0

* Use `aws-sdk` to retrieve objects from S3
* No longer extend `node-tilejson`
