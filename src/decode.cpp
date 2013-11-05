#include "decode.hpp"

#include <sstream>
#include <cstring>

using namespace v8;
using namespace node;

namespace tilelive_s3 {

void freeBuffer(char *data, void *hint) {
    free(data);
    data = NULL;
}

WORKER_BEGIN(Work_Decode) {
    DecodeBaton* baton = static_cast<DecodeBaton*>(req->data);

    Image *image = baton->image.get();
    std::auto_ptr<ImageReader> layer(ImageReader::create(image->data, image->dataLength));

    // Error out on invalid images.
    if (layer.get() == NULL || layer->width == 0 || layer->height == 0) {
        baton->message = layer->message;
        WORKER_END();
    }

    int visibleWidth = (int)layer->width + image->x;
    int visibleHeight = (int)layer->height + image->y;

    // The first image that is in the viewport sets the width/height, if not user supplied.
    if (baton->width <= 0) baton->width = std::max(0, visibleWidth);
    if (baton->height <= 0) baton->height = std::max(0, visibleHeight);

    if (!layer->decode()) {
        // Decoding failed.
        baton->message = layer->message;
        WORKER_END();
    }
    else if (layer->warnings.size()) {
        std::vector<std::string>::iterator pos = layer->warnings.begin();
        std::vector<std::string>::iterator end = layer->warnings.end();
        for (; pos != end; pos++) {
            std::ostringstream msg;
            msg << " " << *pos;
            baton->warnings.push_back(msg.str());
        }
    }

    //bool coversWidth = image->x <= 0 && visibleWidth >= baton->width;
    //bool coversHeight = image->y <= 0 && visibleHeight >= baton->height;
    /*
    if (!layer->alpha && coversWidth && coversHeight) {
        // Skip decoding more layers.
        alpha = false;
    }*/

    // Convenience aliases.
    image->width = layer->width;
    image->height = layer->height;
    image->reader = layer;

    int pixels = baton->width * baton->height;
    if (pixels <= 0) {
        std::ostringstream msg;
        msg << "Image dimensions " << baton->width << "x" << baton->height << " are invalid";
        baton->message = msg.str();
        WORKER_END();
    }

    baton->result = (unsigned char *)malloc(sizeof(unsigned char) * pixels);
    baton->resultLength = sizeof(unsigned char) * pixels;
    assert(baton->result);
    unsigned int *source = image->reader->surface;

    int sourceX = std::max(0, -image->x);
    int sourceY = std::max(0, -image->y);
    int sourcePos = sourceY * image->width + sourceX;

    int width = image->width - sourceX - std::max(0, image->x + image->width - baton->width);
    int height = image->height - sourceY - std::max(0, image->y + image->height - baton->height);

    int targetX = std::max(0, image->x);
    int targetY = std::max(0, image->y);
    int targetPos = targetY * baton->width + targetX;

    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            unsigned rgba = source[sourcePos + x];
            unsigned alpha = (rgba >> 24) & 0xff;
            baton->result[targetPos + x] = alpha;
        }
        sourcePos += image->width;
        targetPos += baton->width;
    }

    WORKER_END();
}

WORKER_BEGIN(Work_AfterDecode) {
    HandleScope scope;
    DecodeBaton* baton = static_cast<DecodeBaton*>(req->data);

    if (!baton->message.length() && baton->result) {
        Local<Array> warnings = Array::New();
        std::vector<std::string>::iterator pos = baton->warnings.begin();
        std::vector<std::string>::iterator end = baton->warnings.end();
        for (int i = 0; pos != end; pos++, i++) {
            warnings->Set(i, String::New((*pos).c_str()));
        }

        // In the success case, node's Buffer implementation frees the result pointer for us.
        Local<Value> argv[] = {
            Local<Value>::New(Null()),
            Local<Value>::New(Buffer::New((char*)baton->result, baton->resultLength, freeBuffer, NULL)->handle_),
            Local<Value>::New(warnings)
        };
        TRY_CATCH_CALL(Context::GetCurrent()->Global(), baton->callback, 3, argv);
    } else {
        Local<Value> argv[] = {
            Local<Value>::New(Exception::Error(String::New(baton->message.c_str())))
        };

        // In the error case, we have to manually free this.
        if (baton->result) {
            free(baton->result);
            baton->result = NULL;
        }

        assert(!baton->callback.IsEmpty());
        TRY_CATCH_CALL(Context::GetCurrent()->Global(), baton->callback, 1, argv);
    }

    delete baton;
    WORKER_END();
}

Handle<Value> Decode(const Arguments& args) {
    HandleScope scope;

    std::auto_ptr<DecodeBaton> baton(new DecodeBaton());

    Local<Object> options;
    if (args.Length() == 0) {
        return TYPE_EXCEPTION("First argument must be a Buffer.");
    } else if (args.Length() == 1) {
        return TYPE_EXCEPTION("Second argument must be a function");
    } else if (args.Length() == 2) {
        // No options provided.
        if (!args[1]->IsFunction()) {
            return TYPE_EXCEPTION("Second argument must be a function.");
        }
        baton->callback = Persistent<Function>::New(Local<Function>::Cast(args[1]));
    }

    Local<Value> buffer = args[0];
    if (!Buffer::HasInstance(args[0])) {
        return TYPE_EXCEPTION("First argument must be a buffer.");
    }

    ImagePtr image(new Image());
    image->buffer = Persistent<Object>::New(buffer->ToObject());

    if (image->buffer.IsEmpty()) {
        return TYPE_EXCEPTION("All elements must be Buffers or objects with a 'buffer' property.");
    }

    image->data = (unsigned char*)node::Buffer::Data(image->buffer);
    image->dataLength = node::Buffer::Length(image->buffer);
    baton->image = image;

    QUEUE_WORK(baton.release(), Work_Decode, (uv_after_work_cb)Work_AfterDecode);

    return scope.Close(Undefined());
}


extern "C" void init(Handle<Object> target) {
    NODE_SET_METHOD(target, "decode", Decode);

    target->Set(
        String::NewSymbol("libpng"),
        String::NewSymbol(PNG_LIBPNG_VER_STRING),
        static_cast<PropertyAttribute>(ReadOnly | DontDelete)
    );
}

NODE_MODULE(decoder, init);
}
