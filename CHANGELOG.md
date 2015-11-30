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
