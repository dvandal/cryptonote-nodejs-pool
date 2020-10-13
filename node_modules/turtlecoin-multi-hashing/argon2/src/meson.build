argon2lib_definitions = ['-DA2_VISCTL']
argon2lib_dependencies = []

if get_option('multithreading').enabled()
    argon2lib_definitions += ['-DARGON2_NO_THREADS']
else
    thread_dep = dependency('threads')
    argon2lib_dependencies += [thread_dep]
endif

argon2_src = [
    'argon2.c',
    'core.c',
    'blake2/blake2b.c',
    'thread.c',
    'encoding.c'
]

compiler = meson.get_compiler('c')
with_optimizations = compiler.compiles(files('opt.c'),
    include_directories: argon2_incdir,
    name: 'Check hardware optimization support')

if with_optimizations
    argon2_src += ['opt.c']
else
    argon2_src += ['ref.c']
endif

###############
# Argon2 libs #
###############

argon2_libs = both_libraries('argon2',
    sources: argon2_src,
    include_directories: argon2_incdir,
    c_args: argon2lib_definitions,
    dependencies: argon2lib_dependencies,
    soversion: conf_data.get('soversion'),
    install: true)

argon2_shared_dep = declare_dependency(dependencies: argon2lib_dependencies,
    include_directories: argon2_incdir,
    compile_args: argon2lib_definitions,
    link_with: argon2_libs.get_shared_lib())

argon2_static_dep = declare_dependency(dependencies: argon2lib_dependencies,
    include_directories: argon2_incdir,
    compile_args: argon2lib_definitions,
    link_with: argon2_libs.get_static_lib())

######################################################
# STATIC for genkat (provide sew points for logging) #
######################################################

argon2libgenkat_definitions = argon2lib_definitions + ['-DGENKAT']

argon2_lib_genkat = static_library('argon2-static-genkat',
    sources: argon2_src,
    include_directories: argon2_incdir,
    c_args: argon2libgenkat_definitions,
    dependencies: argon2lib_dependencies,
    install: false)

argon2_genkat_dep = declare_dependency(dependencies: argon2lib_dependencies,
    include_directories: [argon2_incdir, include_directories('.')],
    compile_args: argon2libgenkat_definitions,
    link_with: argon2_lib_genkat)
