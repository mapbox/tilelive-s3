import os
from shutil import copy2 as copy

import Options
import Utils

TARGET = 'decoder'
TARGET_FILE = '%s.node' % TARGET
built = 'build/Release/%s' % TARGET_FILE
builtV4 = 'build/default/%s' % TARGET_FILE
dest = 'lib/%s' % TARGET_FILE


test_prog = '''
#include "stdio.h"
#ifdef __cplusplus
extern "C" {
#endif
#include "%s"
#ifdef __cplusplus
}
#endif

int main() {
    return 0;
}
'''

png_inc_name = 'png.h'
png_search_paths = ['/usr', '/usr/local']
if Options.platform == 'darwin':
    # X11 has png headers
    png_search_paths.insert(0, '/usr/X11')

def set_options(opt):
    opt.tool_options("compiler_cxx")
    opt.tool_options('misc')
    opt.add_option('--with-png',
        action='store',
        default=None,
        help='Directory prefix containing png "lib" and "include" files',
        dest='png_dir'
    )

def _conf_exit(conf, msg):
    conf.fatal('\n\n' + msg + '\n...check the build/config.log for details')

def _check_png(conf, path):
    norm_path = os.path.normpath(os.path.realpath(path))
    lib = os.path.join(norm_path, 'lib')
    inc = os.path.join(norm_path, 'include')
    header = os.path.join(inc, png_inc_name)
    if conf.check(
            lib='png',
            fragment=test_prog % header,
            uselib_store='PNG',
            libpath=lib,
            includes=inc,
            msg='Checking for libpng at %s' % norm_path):
        return True

    return False

def configure(conf):
    conf.check_tool("compiler_cxx")
    conf.check_tool("node_addon")

    o = Options.options

    # png checks
    found_png = False
    if o.png_dir:
        # manual configuration
        found_png = _check_png(conf, o.png_dir)
    else:
        # automatic configuration
        for path in png_search_paths:
            found_png = _check_png(conf, path)
            if found_png:
                break

    if not found_png:
        _conf_exit(conf, 'png not found: searched %s \nuse --with-png to point to the location of your png libs and headers' % png_search_paths)


def build(bld):
    obj = bld.new_task_gen("cxx", "shlib", "node_addon")
    # "-fcatch-undefined-behavior","-ftrapv","-fwrapv"
    obj.cxxflags = ["-O3", "-g", "-pedantic","-D_FILE_OFFSET_BITS=64", "-D_LARGEFILE_SOURCE", "-Wall"]
    obj.target = TARGET
    obj.source = ["src/reader.cpp", "src/decode.cpp",]
    obj.uselib = ["PNG"]

def shutdown():
    if Options.commands['clean']:
        if os.path.exists(TARGET_FILE):
            unlink(TARGET_FILE)
    else:
        if os.path.exists(builtV4):
            copy(builtV4, dest)
        if os.path.exists(built):
            copy(built, dest)

