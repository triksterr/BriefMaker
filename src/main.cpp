#include <iostream>
#include <fstream>
#include <string>
#include <filesystem>
#include <vector>
#include <sstream>
#include <regex>
#include <algorithm>

extern "C" {
    #include "tree_sitter/api.h"
}

extern "C" const TSLanguage *tree_sitter_cpp(void);
extern "C" const TSLanguage *tree_sitter_javascript(void);

namespace fs = std::filesystem;

struct BriefEntity {
    std::string type;      // "Class", "Function", "Method", "Macro", "Constant", "TypeAlias"
    std::string prefix;    // e.g. "MyClass::"
    std::string signature; // e.g. "void myMethod(int arg)"
    std::string comment;
    int startLine;
    int endLine;
    uint32_t startByte;
    uint32_t endByte;
};

struct Comment {
    std::string text;
    int startLine;
    int endLine;
    uint32_t startByte;
    uint32_t endByte;
};

std::string ReadFileToUtf8String(const fs::path& filePath) {
    std::ifstream file(filePath, std::ios::binary);
    if (!file.is_open()) {
        throw std::runtime_error("Не удалось открыть файл: " + filePath.string());
    }
    std::stringstream buffer;
    buffer << file.rdbuf();
    std::string content = buffer.str();

    if (content.length() >= 3 && 
        static_cast<unsigned char>(content[0]) == 0xEF && 
        static_cast<unsigned char>(content[1]) == 0xBB && 
        static_cast<unsigned char>(content[2]) == 0xBF) {
        content.erase(0, 3);
    }
    return content;
}

void WriteStringToFile(const fs::path& filePath, const std::string& content) {
    std::ofstream file(filePath, std::ios::binary);
    if (!file.is_open()) {
        throw std::runtime_error("Не удалось создать выходной файл: " + filePath.string());
    }
    file << content;
}

std::string GetNodeText(TSNode node, const std::string& code) {
    uint32_t start = ts_node_start_byte(node);
    uint32_t end = ts_node_end_byte(node);
    if (start < end && end <= code.length()) {
        return code.substr(start, end - start);
    }
    return "";
}

std::string CleanUpSignature(const std::string& rawSig) {
    std::string sig = rawSig;
    std::replace(sig.begin(), sig.end(), '\n', ' ');
    std::replace(sig.begin(), sig.end(), '\r', ' ');
    
    std::regex wsRegex("\\s+");
    sig = std::regex_replace(sig, wsRegex, " ");
    
    sig.erase(0, sig.find_first_not_of(" \t"));
    if (!sig.empty()) sig.erase(sig.find_last_not_of(" \t") + 1);
    return sig;
}

// FIX: Добавлена вспомогательная функция для тримминга строк
std::string TrimString(const std::string& s) {
    size_t start = s.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    size_t end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}

class BriefGenerator {
public:
    std::vector<BriefEntity> entities;
    std::vector<Comment> comments;
    std::string code;

    void CollectComments(TSNode node) {
        if (strcmp(ts_node_type(node), "comment") == 0) {
            Comment c;
            c.text = GetNodeText(node, code);
            c.startLine = ts_node_start_point(node).row + 1;
            c.endLine = ts_node_end_point(node).row + 1;
            c.startByte = ts_node_start_byte(node);
            c.endByte = ts_node_end_byte(node);
            comments.push_back(c);
        }
        uint32_t count = ts_node_child_count(node);
        for (uint32_t i = 0; i < count; i++) {
            CollectComments(ts_node_child(node, i));
        }
    }

    void ProcessNode(TSNode node, const std::string& currentPrefix) {
        const char* type = ts_node_type(node);
        int startLine = ts_node_start_point(node).row + 1;
        int endLine = ts_node_end_point(node).row + 1;
        uint32_t startByte = ts_node_start_byte(node);
        uint32_t endByte = ts_node_end_byte(node);

        if (strcmp(type, "namespace_definition") == 0) {
            std::string name = "";
            uint32_t count = ts_node_child_count(node);
            for (uint32_t i = 0; i < count; i++) {
                TSNode child = ts_node_child(node, i);
                if (strcmp(ts_node_type(child), "namespace_identifier") == 0) {
                    name = GetNodeText(child, code);
                    break;
                }
            }
            std::string newPrefix = currentPrefix + name + "::";
            // FIX: Спускаемся в тело неймспейса (declaration_list)
            for (uint32_t i = 0; i < count; i++) {
                ProcessNode(ts_node_child(node, i), newPrefix);
            }
        }
        else if (strcmp(type, "class_specifier") == 0 || strcmp(type, "struct_specifier") == 0) {
            std::string name = "";
            uint32_t count = ts_node_child_count(node);
            for (uint32_t i = 0; i < count; i++) {
                TSNode child = ts_node_child(node, i);
                if (strcmp(ts_node_type(child), "type_identifier") == 0) {
                    name = GetNodeText(child, code);
                    break;
                }
            }
            
            BriefEntity e;
            e.type = "Class";
            e.prefix = currentPrefix;
            e.signature = name;
            e.startLine = startLine;
            e.endLine = endLine;
            e.startByte = startByte;
            e.endByte = endByte;
            entities.push_back(e);

            std::string newPrefix = currentPrefix + name + "::";
            for (uint32_t i = 0; i < count; i++) {
                ProcessNode(ts_node_child(node, i), newPrefix);
            }
        }
        else if (strcmp(type, "function_definition") == 0) {
            std::string sig = "";
            TSNode body = {0};
            uint32_t count = ts_node_child_count(node);
            for (uint32_t i = 0; i < count; i++) {
                TSNode child = ts_node_child(node, i);
                const char* childType = ts_node_type(child);
                if (strcmp(childType, "compound_statement") == 0 || 
                    strcmp(childType, "try_statement") == 0) {
                    body = child;
                    break;
                }
            }
            
            int sigEndLine = startLine;
            if (!ts_node_is_null(body)) {
                sig = code.substr(startByte, ts_node_start_byte(body) - startByte);
                sigEndLine = ts_node_start_point(body).row + 1;
            } else {
                sig = GetNodeText(node, code);
            }
            sig = CleanUpSignature(sig);

            BriefEntity e;
            e.type = (currentPrefix.empty() ? "Function" : "Method");
            e.prefix = currentPrefix;
            e.signature = sig;
            e.startLine = startLine;
            e.endLine = endLine;
            e.startByte = startByte;
            e.endByte = endByte;
            entities.push_back(e);
        }
        else if (strcmp(type, "preproc_def") == 0 || strcmp(type, "preproc_function_def") == 0) {
            std::string text = GetNodeText(node, code);
            BriefEntity e;
            e.type = "Macro";
            e.signature = CleanUpSignature(text);
            e.startLine = startLine;
            e.endLine = endLine;
            e.startByte = startByte;
            e.endByte = endByte;
            entities.push_back(e);
        }
        else if (strcmp(type, "alias_declaration") == 0 || strcmp(type, "type_definition") == 0) {
            std::string text = GetNodeText(node, code);
            BriefEntity e;
            e.type = "TypeAlias";
            e.prefix = currentPrefix;
            e.signature = CleanUpSignature(text);
            e.startLine = startLine;
            e.endLine = startLine;
            e.startByte = startByte;
            e.endByte = endByte;
            entities.push_back(e);
        }
        else if (strcmp(type, "declaration") == 0) {
            std::string text = GetNodeText(node, code);
            BriefEntity e;
            e.type = "Constant"; 
            e.prefix = currentPrefix;
            e.signature = CleanUpSignature(text);
            e.startLine = startLine;
            e.endLine = startLine;
            e.startByte = startByte;
            e.endByte = endByte;
            entities.push_back(e);
        }

        // FIX: Рекурсивный спуск для всех контейнеров (включая declaration_list и field_declaration_list)
        if (strcmp(type, "translation_unit") == 0 || 
            strcmp(type, "linkage_specification") == 0 ||
            strcmp(type, "declaration_list") == 0 ||
            strcmp(type, "field_declaration_list") == 0 ||
            strcmp(type, "base_class_clause") == 0) {
            uint32_t count = ts_node_child_count(node);
            for (uint32_t i = 0; i < count; i++) {
                ProcessNode(ts_node_child(node, i), currentPrefix);
            }
        }
    }

    void AttachComments() {
        // Сортируем комментарии по startByte для удобного поиска
        std::sort(comments.begin(), comments.end(), [](const Comment& a, const Comment& b) {
            return a.startByte < b.startByte;
        });

        for (auto& e : entities) {
            std::vector<std::string> topCommentTexts;
            std::string inlineComment = "";

            // 1. Ищем комментарии НАД сущностью
            for (int i = (int)comments.size() - 1; i >= 0; i--) {
                const auto& c = comments[i];
                if (c.endByte < e.startByte) {
                    if (e.startLine - c.endLine <= 1) {
                        topCommentTexts.push_back(c.text);
                    } else {
                        break; 
                    }
                }
            }
            std::reverse(topCommentTexts.begin(), topCommentTexts.end());

            // 2. Ищем инлайн-комментарий
            // FIX: Ищем на endLine сущности, после endByte (для однострочных функций после '}' или ';')
            // Или на startLine (для многострочных, если комментарий стоит сразу после сигнатуры перед '{')
            for (const auto& c : comments) {
                // Вариант A: Инлайн после конца сущности на той же строке
                if (c.startLine == e.endLine && c.startByte > e.endByte) {
                    inlineComment = c.text;
                    break;
                }
                // Вариант B: Инлайн внутри заголовка функции (перед '{' на той же строке)
                if ((e.type == "Function" || e.type == "Method") && 
                    c.startLine == e.startLine && c.startByte > e.startByte && c.startByte < e.endByte) {
                    inlineComment = c.text;
                    break;
                }
            }

            // 3. Очищаем верхние комментарии (Doxygen, /* */, //)
            std::string cleanTop = "";
            bool inBlockComment = false;
            for (const auto& rawComment : topCommentTexts) {
                std::vector<std::string> lines;
                std::istringstream iss(rawComment);
                std::string line;
                while(std::getline(iss, line)) {
                    lines.push_back(line);
                }

                for (auto& l : lines) {
                    l = TrimString(l);
                    if (l.empty()) continue;

                    if (l.substr(0, 3) == "///") {
                        cleanTop += TrimString(l.substr(3)) + "\n";
                    } else if (l.substr(0, 2) == "//") {
                        cleanTop += TrimString(l.substr(2)) + "\n";
                    } else if (l.find("/*") != std::string::npos) {
                        inBlockComment = true;
                        size_t startIdx = l.find("/*");
                        std::string text = l.substr(startIdx + 2);
                        if (!text.empty() && (text[0] == '*' || text[0] == '!')) {
                            text = text.substr(1);
                        }
                        size_t endIdx = text.find("*/");
                        if (endIdx != std::string::npos) {
                            text = text.substr(0, endIdx);
                            inBlockComment = false;
                        }
                        text = TrimString(text);
                        if (!text.empty()) cleanTop += text + "\n";
                    } else if (l.find("*/") != std::string::npos) {
                        inBlockComment = false;
                        size_t endIdx = l.find("*/");
                        std::string text = l.substr(0, endIdx);
                        if (!text.empty() && text[0] == '*') text = text.substr(1);
                        text = TrimString(text);
                        if (!text.empty()) cleanTop += text + "\n";
                    } else if (inBlockComment) {
                        std::string text = l;
                        if (!text.empty() && text[0] == '*') text = text.substr(1);
                        text = TrimString(text);
                        if (!text.empty()) cleanTop += text + "\n";
                    }
                }
            }
            if (!cleanTop.empty() && cleanTop.back() == '\n') {
                cleanTop.pop_back();
            }

            // 4. Очищаем инлайн
            std::string cleanInline = "";
            if (!inlineComment.empty()) {
                std::string c = inlineComment;
                if (c.substr(0, 2) == "//") {
                    c = c.substr(2);
                } else if (c.substr(0, 2) == "/*") {
                    c = c.substr(2);
                    if (c.length() >= 2 && c.substr(c.length()-2) == "*/") {
                        c = c.substr(0, c.length()-2);
                    }
                }
                cleanInline = TrimString(c);
            }

            // 5. Собираем итог
            e.comment = "";
            if (!cleanTop.empty()) e.comment += cleanTop;
            if (!cleanInline.empty()) {
                if (!e.comment.empty()) e.comment += " | ";
                e.comment += cleanInline;
            }
        }
    }
};

std::string GenerateMarkdown(const std::string& filePath, const std::vector<BriefEntity>& entities) {
    std::stringstream md;
    md << "File: " << filePath << "\n\n";
    
    for (const auto& e : entities) {
        std::string prefix = e.prefix;
        std::string name = e.signature;
        
        if (e.type == "Class") {
            md << "# Class: " << prefix << name << "\n";
        } else if (e.type == "Function" || e.type == "Method") {
            md << "## " << e.type << ": " << prefix << name << "\n";
        } else if (e.type == "Macro") {
            md << "# " << e.type << " " << name << "\n";
        } else if (e.type == "Constant" || e.type == "TypeAlias") {
            md << "# " << e.type << ": " << prefix << name << "\n";
        }
        
        if (!e.comment.empty()) {
            md << e.comment << "\n";
        }
        
        if (e.startLine == e.endLine) {
            md << "Стр: " << e.startLine << "\n\n";
        } else {
            md << "Стр: " << e.startLine << " - " << e.endLine << "\n\n";
        }
    }
    return md.str();
}

int main(int argc, char* argv[]) {
    std::setlocale(LC_ALL, ".65001");

    if (argc < 2) {
        std::cerr << "Использование: BriefMaker.exe <путь_к_файлу> [путь_к_выходу]\n";
        return 1;
    }

    fs::path inputPath = argv[1];
    fs::path outputPath;

    if (argc >= 3) {
        outputPath = argv[2];
        std::string outStr = outputPath.string();
        if (!outStr.empty() && (outStr.back() == '/' || outStr.back() == '\\')) {
            outputPath /= inputPath.filename().string() + ".brief.md";
        }
    } else {
        outputPath = inputPath;
        outputPath.replace_extension(inputPath.extension().string() + ".brief.md");
    }

    if (!fs::exists(inputPath)) {
        std::cerr << "Файл не найден: " << inputPath << "\n";
        return 1;
    }

    std::string ext = inputPath.extension().string();
    const TSLanguage* lang = nullptr;
    if (ext == ".cpp" || ext == ".h" || ext == ".hpp" || ext == ".cc") {
        lang = tree_sitter_cpp();
    } else if (ext == ".js" || ext == ".jsx" || ext == ".ts") {
        lang = tree_sitter_javascript();
    } else {
        std::cerr << "Неподдерживаемое расширение: " << ext << "\n";
        return 1;
    }

    try {
        std::string code = ReadFileToUtf8String(inputPath);

        TSParser* parser = ts_parser_new();
        ts_parser_set_language(parser, lang);

        TSTree* tree = ts_parser_parse_string(parser, nullptr, code.c_str(), code.size());
        TSNode rootNode = ts_tree_root_node(tree);

        BriefGenerator gen;
        gen.code = code;
        gen.CollectComments(rootNode);
        gen.ProcessNode(rootNode, "");
        gen.AttachComments();

        std::string md = GenerateMarkdown(inputPath.filename().string(), gen.entities);
        WriteStringToFile(outputPath, md);

        std::cout << "Бриф успешно создан: " << outputPath << "\n";

        ts_tree_delete(tree);
        ts_parser_delete(parser);

    } catch (const std::exception& e) {
        std::cerr << "Ошибка: " << e.what() << "\n";
        return 1;
    }

    return 0;
}