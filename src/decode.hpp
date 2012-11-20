#ifndef NODE_DECODE_SRC_DECODE_H
#define NODE_DECODE_SRC_DECODE_H

#include <v8.h>
#include <node.h>
#include <node_version.h>
#include <node_buffer.h>
#include <png.h>

#include <cstdlib>
#include <cstring>

#include <string>
#include <vector>
#include <tr1/memory>

#include "reader.hpp"


#if NODE_MAJOR_VERSION == 0 && NODE_MINOR_VERSION <= 4
    #define WORKER_BEGIN(name)                  int name(eio_req *req)
    #define WORKER_END()                        return 0;
    #define QUEUE_WORK(baton, worker, after)    eio_custom((worker), EIO_PRI_DEFAULT, (after), (baton));
#else
    #define WORKER_BEGIN(name)                  void name(uv_work_t *req)
    #define WORKER_END()                        return;
    #define QUEUE_WORK(baton, worker, after)    uv_queue_work(uv_default_loop(), &(baton)->request, (worker), (after));
#endif

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
    std::auto_ptr<ImageReader> reader;
};

typedef std::tr1::shared_ptr<Image> ImagePtr;

#define TRY_CATCH_CALL(context, callback, argc, argv)                          \
{   v8::TryCatch try_catch;                                                    \
    (callback)->Call((context), (argc), (argv));                               \
    if (try_catch.HasCaught()) {                                               \
        node::FatalException(try_catch);                                       \
    }                                                                          }

#define TYPE_EXCEPTION(message)                                                \
    ThrowException(Exception::TypeError(String::New(message)))

v8::Handle<v8::Value> Decode(const v8::Arguments& args);
WORKER_BEGIN(Work_Decode);
WORKER_BEGIN(Work_AfterDecode);


struct DecodeBaton {
#if NODE_MINOR_VERSION >= 5 || NODE_MAJOR_VERSION > 0
    uv_work_t request;
#endif
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
        (*image).buffer.Dispose();

#if NODE_MAJOR_VERSION == 0 && NODE_MINOR_VERSION <= 4
        ev_unref(EV_DEFAULT_UC);
#endif
        // Note: The result buffer is freed by the node Buffer's free callback

        callback.Dispose();
    }
};

#endif

}
