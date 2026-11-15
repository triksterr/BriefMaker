cmake_minimum_required(VERSION 3.15)
project(BriefMaker C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 1. Ядро Tree-sitter (чистый C)
add_library(tree-sitter-core STATIC
    libs/tree-sitter/lib/src/lib.c
)
target_include_directories(tree-sitter-core PUBLIC libs/tree-sitter/lib/include)

# ВАЖНО: MSVC нужно явно указать стандарт C11, чтобы понимать _Static_assert
# /w - отключить предупреждения чужого C-кода
# /std:c11 - включить поддержку C11
if(MSVC)
    target_compile_options(tree-sitter-core PRIVATE /w /std:c11)
else()
    target_compile_options(tree-sitter-core PRIVATE -w)
endif()

# 2. Макрос для безопасной компиляции грамматик
function(add_ts_grammar NAME DIR)
    # Ищем парсер и любые варианты сканера (.c или .cc)
    file(GLOB SRC_FILES 
        "${DIR}/src/parser.c" 
        "${DIR}/src/scanner.c" 
        "${DIR}/src/scanner.cc"
    )
    
    if(SRC_FILES)
        add_library(${NAME} STATIC ${SRC_FILES})
        target_include_directories(${NAME} PRIVATE "${DIR}/src")
        target_link_libraries(${NAME} PRIVATE tree-sitter-core)
        
        # Для грамматик тоже нужен C11 и отключение варнингов
        if(MSVC)
            target_compile_options(${NAME} PRIVATE /w /std:c11)
        else()
            target_compile_options(${NAME} PRIVATE -w)
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