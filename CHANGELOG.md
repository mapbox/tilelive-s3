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
