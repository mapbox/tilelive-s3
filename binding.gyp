{
  'conditions': [
      ['OS=="win"', {
        'variables': {
          'copy_command%': 'copy',
          'bin_name':'call'
        },
      },{
        'variables': {
          'copy_command%': 'cp',
          'bin_name':'node'
        },
      }]
  ],
  'target_defaults': {
      'default_configuration': 'Release',
      'configurations': {
          'Debug': {
              'cflags_cc!': ['-O3', '-DNDEBUG'],
              'xcode_settings': {
                'OTHER_CPLUSPLUSFLAGS!':['-O3', '-DNDEBUG']
              },
              'msvs_settings': {
                 'VCCLCompilerTool': {
                     'ExceptionHandling': 1,
                     'RuntimeTypeInfo':'true',
                     'RuntimeLibrary': '3'  # /MDd
                 }
              }
          },
          'Release': {

          }
      },
      'include_dirs': [
          './src',
          
      ],
      'cflags_cc!': ['-fno-rtti', '-fno-exceptions'],
      'cflags_cc' : [
          '<!@(pkg-config libpng --cflags)'
      ],
      'libraries':[
        '<!@(pkg-config libpng --libs --static)'
      ]
  },
  'targets': [
    {
      'target_name': 'decoder',
      'sources': ["src/decode.cpp",
                  "src/reader.cpp"
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
      'dependencies': [ 'decoder' ],
      'actions': [
        {
          'action_name': 'move_node_module',
          'inputs': [
            '<@(PRODUCT_DIR)/decoder.node'
          ],
          'outputs': [
            'lib/binding/tilelive_s3.node'
          ],
          'action': ['<@(copy_command)', '<@(PRODUCT_DIR)/decoder.node', 'lib/binding/tilelive_s3.node']
        }
      ]
    }
  ]
}
