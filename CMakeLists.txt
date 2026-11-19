cmake_minimum_required(VERSION 3.15)
project(BriefMaker C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# для чистого C-кода Tree-sitter
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Если сборка идет не через Visual Studio (например, из консоли через make/ninja),
# устанавливаем Release как конфигурацию по умолчанию.
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Choose the type of build." FORCE)
endif()

# СТАТИЧЕСКАЯ ЛИНКОВКА РАНАЙМА MSVC
# Для Debug будет использоваться /MTd, для Release - /MT.
# Это делает .exe файл независимым от наличия vcruntime140.dll на целевой машине.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

# 1. Ядро Tree-sitter (чистый C)
add_library(tree-sitter-core STATIC
    libs/tree-sitter/lib/src/lib.c
)
target_include_directories(tree-sitter-core PUBLIC libs/tree-sitter/lib/include)

if(MSVC)
    # /w - отключить предупреждения чужого кода
    # /std:c11 - поддержка C11 (нужна для _Static_assert)
    target_compile_options(tree-sitter-core PRIVATE 
        /w /std:c11
        $<$<CONFIG:Release>:/O2>
        $<$<CONFIG:Debug>:/Od>
    )
else()
    target_compile_options(tree-sitter-core PRIVATE 
        -w
        $<$<CONFIG:Release>:-O3>
        $<$<CONFIG:Debug>:-O0 -g>
    )
endif()

# 2. Макрос для безопасной компиляции грамматик
function(add_ts_grammar NAME DIR)
    file(GLOB SRC_FILES 
        "${DIR}/src/parser.c" 
        "${DIR}/src/scanner.c" 
        "${DIR}/src/scanner.cc"
    )
    
    if(SRC_FILES)
        add_library(${NAME} STATIC ${SRC_FILES})
        target_include_directories(${NAME} PRIVATE "${DIR}/src")
        target_link_libraries(${NAME} PRIVATE tree-sitter-core)
        
        if(MSVC)
            target_compile_options(${NAME} PRIVATE 
                /w /std:c11
                $<$<CONFIG:Release>:/O2>
                $<$<CONFIG:Debug>:/Od>
            )
        else()
            target_compile_options(${NAME} PRIVATE 
                -w
                $<$<CONFIG:Release>:-O3>
                $<$<CONFIG:Debug>:-O0 -g>
            )
        endif()
    else()
        message(FATAL_ERROR "Не найдены исходники для грамматики ${NAME} в ${DIR}/src")
    endif()
endfunction()

add_ts_grammar(tree-sitter-cpp libs/tree-sitter-cpp)
add_ts_grammar(tree-sitter-javascript libs/tree-sitter-javascript)

# 3. Наше приложение
add_executable(BriefMaker src/main.cpp)
target_link_libraries(BriefMaker PRIVATE tree-sitter-core tree-sitter-cpp tree-sitter-javascript)
target_include_directories(BriefMaker PRIVATE libs/tree-sitter/lib/include)

# Оптимизации для нашего C++ кода
if(MSVC)
    target_compile_options(BriefMaker PRIVATE 
        $<$<CONFIG:Release>:/O2>
        $<$<CONFIG:Debug>:/Od /Zi>
    )
else()
    target_compile_options(BriefMaker PRIVATE 
        $<$<CONFIG:Release>:-O3>
        $<$<CONFIG:Debug>:-O0 -g>
    )
endif()