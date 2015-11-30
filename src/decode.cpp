#include "decode.hpp"

#include <sstream>
#include <cstring>

using namespace v8;
using namespace node;

namespace tilelive_s3 {

void Work_Decode(uv_work_t* req) {
    DecodeBaton* baton = static_cast<DecodeBaton*>(req->data);

    Image *image = baton->image.get();
    std::unique_ptr<ImageReader> layer(ImageReader::create(image->data, image->dataLength));

    // Error out on invalid images.
    if (layer.get() == NULL || layer->width == 0 || layer->height == 0) {
        baton->message = layer->message;
        return;
    }

    int visibleWidth = (int)layer->width + image->x;
    int visibleHeight = (int)layer->height + image->y;

    // The first image that is in the viewport sets the width/height, if not user supplied.
    if (baton->width <= 0) baton->width = std::max(0, visibleWidth);
    if (baton->height <= 0) baton->height = std::max(0, visibleHeight);

    if (!layer->decode()) {
        // Decoding failed.
        baton->message = layer->message;
        return;
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
    image->reader = std::move(layer);

    int pixels = baton->width * baton->height;
    if (pixels <= 0) {
        std::ostringstream msg;
        msg << "Image dimensions " << baton->width << "x" << baton->height << " are invalid";
        baton->message = msg.str();
        return;
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
}

void Work_AfterDecode(uv_work_t* req) {
    Nan::HandleScope scope;

    DecodeBaton* baton = static_cast<DecodeBaton*>(req->data);

    if (!baton->message.length() && baton->result) {
        Local<Array> warnings = Nan::New<Array>();
        std::vector<std::string>::iterator pos = baton->warnings.begin();
        std::vector<std::string>::iterator end = baton->warnings.end();
        for (int i = 0; pos != end; pos++, i++) {
            warnings->Set(i, Nan::New<String>((*pos).c_str()).ToLocalChecked());
        }

        // In the success case, node's Buffer implementation frees the result pointer for us.
        Local<Value> argv[] = {
            Nan::Null(),
            Nan::NewBuffer((char*)baton->result, baton->resultLength).ToLocalChecked(),
            warnings
        };
        Nan::MakeCallback(Nan::GetCurrentContext()->Global(), Nan::New(baton->callback), 3, argv);
    } else {
        Local<Value> argv[] = {
            Nan::New<Value>(Exception::Error(Nan::New<String>(baton->message.c_str()).ToLocalChecked()))
        };
        assert(!baton->callback.IsEmpty());
        Nan::MakeCallback(Nan::GetCurrentContext()->Global(), Nan::New(baton->callback), 1, argv);
    }
    delete baton;
}

NAN_METHOD(Decode) {
    std::unique_ptr<DecodeBaton> baton(new DecodeBaton());

    Local<Object> options;
    if (info.Length() == 0) {
        Nan::TypeError("First argument must be a Buffer.");
        info.GetReturnValue().SetUndefined();
    } else if (info.Length() == 1) {
        Nan::TypeError("Second argument must be a function");
        info.GetReturnValue().SetUndefined();
    } else if (info.Length() == 2) {
        // No options provided.
        if (!info[1]->IsFunction()) {
            Nan::TypeError("Second argument must be a function.");
            info.GetReturnValue().SetUndefined();
        }
        baton->callback.Reset(info[1].As<Function>());
    }


    Local<Value> buffer = info[0].As<Object>();
    if (!Buffer::HasInstance(info[0])) {
        Nan::TypeError("First argument must be a buffer.");
        info.GetReturnValue().SetUndefined();
    }

    ImagePtr image(new Image());

    Local<Object> buf = buffer.As<Object>();
    image->buffer.Reset(buf);

    if (image->buffer.IsEmpty()) {
        Nan::TypeError("All elements must be Buffers or objects with a 'buffer' property.");
        info.GetReturnValue().SetUndefined();
    }

    image->data = (unsigned char*)node::Buffer::Data(buf);
    image->dataLength = node::Buffer::Length(buf);
    baton->image = std::move(image);

    uv_queue_work(uv_default_loop(), &(baton.release())->request, Work_Decode, (uv_after_work_cb)Work_AfterDecode);

    info.GetReturnValue().SetUndefined();
}


extern "C" void init(Handle<Object> target) {
    Nan::SetMethod(target, "decode", Decode);

    target->ForceSet(
        Nan::New<String>("libpng").ToLocalChecked(),
        Nan::New<String>(PNG_LIBPNG_VER_STRING).ToLocalChecked(),
        static_cast<PropertyAttribute>(ReadOnly | DontDelete)
    );
}

NODE_MODULE(tilelive_s3, init);
}
