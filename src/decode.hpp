#ifndef NODE_DECODE_SRC_DECODE_H
#define NODE_DECODE_SRC_DECODE_H

#include <nan.h>

#include <png.h>

#include <cstdlib>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

#include "reader.hpp"

namespace tilelive_s3 {

typedef v8::Persistent<v8::Object> PersistentObject;

struct Image {
    Image() :
        data(NULL),
        dataLength(0),
        x(0),
        y(0),
        width(0),
        height(0) {}
    PersistentObject buffer;
    unsigned char *data;
    size_t dataLength;
    int x, y;
    int width, height;
    std::unique_ptr<ImageReader> reader;
};

typedef std::unique_ptr<Image> ImagePtr;


NAN_METHOD(Decode);

struct DecodeBaton {
    uv_work_t request;
    v8::Persistent<v8::Function> callback;
    ImagePtr image;

    std::string message;
    std::vector<std::string> warnings;

    int width;
    int height;

    unsigned char* result;
    size_t resultLength;

    DecodeBaton() :
        width(0),
        height(0),
        result(NULL),
        resultLength(0)
    {
#if NODE_MAJOR_VERSION == 0 && NODE_MINOR_VERSION <= 4
        ev_ref(EV_DEFAULT_UC);
#else
        this->request.data = this;
#endif
    }

    ~DecodeBaton() {
        NanDisposePersistent((*image).buffer);

#if NODE_MAJOR_VERSION == 0 && NODE_MINOR_VERSION <= 4
        ev_unref(EV_DEFAULT_UC);
#endif
        // Note: The result buffer is freed by the node Buffer's free callback

        NanDisposePersistent(callback);
    }
};

#endif

}
