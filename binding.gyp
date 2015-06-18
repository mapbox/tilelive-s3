{
  'targets': [
    {
      'target_name': '<(module_name)',
      'sources': ["src/decode.cpp",
                  "src/reader.cpp"
      ],
      'include_dirs': [
          './src',
          "<!(node -e \"require('nan')\")"
      ],
      'cflags_cc!': ['-fno-rtti', '-fno-exceptions'],
      'cflags_cc' : [
          '<!@(pkg-config libpng --cflags)'
      ],
      'libraries':[
        '<!@(pkg-config libpng --libs --static)'
      ],
      'xcode_settings': {
        'OTHER_CPLUSPLUSFLAGS':[
           '<!@(pkg-config libpng --cflags)'
        ],
        'GCC_ENABLE_CPP_RTTI': 'YES',
        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
      }
    },
    {
      'target_name': 'action_after_build',
      'type': 'none',
      'dependencies': [ '<(module_name)' ],
      'copies': [
          {
            'files': [ '<(PRODUCT_DIR)/<(module_name).node' ],
            'destination': '<(module_path)'
          }
      ]
    }
  ]
}
