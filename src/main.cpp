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

struct Strings {
    std::string fileLabel;
    std::string classType;
    std::string methodType;
    std::string functionType;
    std::string macroType;
    std::string constantType;
    std::string typeAliasType;
    std::string fieldType;
    std::string getterType;
    std::string setterType;
    
    std::string lineSingle;
    std::string lineRange;
    
    std::string returns;
    
    std::string usage;
    std::string fileNotFound;
    std::string unsupportedExt;
    std::string briefCreated;
    std::string error;
    std::string langEnabled;
};

const Strings STRINGS_EN = {
    "File: ",
    "Class", "Method", "Function", "Macro", "Constant", "TypeAlias", "Field",
    "Method (getter)", "Method (setter)",
    "Line: ", "Lines: ",
    "Returns: ",
    "Usage: BriefMaker.exe <input_file> [output_path] [-ru]",
    "File not found: ",
    "Unsupported extension: ",
    "Brief successfully created: ",
    "Error: ",
    ""
};

const Strings STRINGS_RU = {
    "Файл: ",
    "Класс", "Метод", "Функция", "Макрос", "Константа", "Псевдоним типа", "Поле",
    "Метод (геттер)", "Метод (сеттер)",
    "Стр: ", "Стр: ",
    "Возвращает: ",
    "Использование: BriefMaker.exe <входной_файл> [путь_вывода] [-ru]",
    "Файл не найден: ",
    "Неподдерживаемое расширение: ",
    "Бриф успешно создан: ",
    "Ошибка: ",
    "Включён русский язык интерфейса."
};

struct BriefEntity {
    std::string type;      
    std::string prefix;    
    std::string signature; 
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
        throw std::runtime_error(filePath.string());
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
        throw std::runtime_error(filePath.string());
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

std::string TrimString(const std::string& s) {
    size_t start = s.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    size_t end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}

std::string RemoveInlineCommentsFromSignature(const std::string& rawSig) {
    std::string sig = rawSig;
    std::replace(sig.begin(), sig.end(), '\n', ' ');
    std::replace(sig.begin(), sig.end(), '\r', ' ');
    std::regex wsRegex("\\s+");
    sig = std::regex_replace(sig, wsRegex, " ");
    
    bool inString = false;
    bool inChar = false;
    char stringChar = 0;
    
    for (size_t i = 0; i < sig.length(); ++i) {
        char c = sig[i];
        if (!inString && !inChar) {
            if (c == '"' || c == '\'' || c == '`') { inString = true; stringChar = c; }
            else if (c == '/' && i + 1 < sig.length()) {
                if (sig[i+1] == '/' || sig[i+1] == '*') {
                    return TrimString(sig.substr(0, i));
                }
            }
        } else {
            if (c == stringChar) {
                int backslashes = 0;
                for (int j = (int)i - 1; j >= 0 && sig[j] == '\\'; --j) backslashes++;
                if (backslashes % 2 == 0) {
                    inString = false;
                    inChar = false;
                }
            }
        }
    }
    return TrimString(sig);
}

std::string CleanDoxygenLine(const std::string& line, const Strings& S) {
    std::string l = TrimString(line);
    if (l.empty()) return "";

    static const std::regex separatorRegex("^[=\\-*#~]+$");
    if (std::regex_match(l, separatorRegex)) return "";

    static const std::regex briefRegex("^@brief\\s+(.*)", std::regex::icase);
    static const std::regex detailsRegex("^@details\\s+(.*)", std::regex::icase);
    static const std::regex paramRegex("^@param\\s+(\\w+)\\s*(.*)", std::regex::icase);
    static const std::regex returnRegex("^@return\\s*(.*)", std::regex::icase);
    static const std::regex dropRegex("^@(author|date|version|file|class|struct|namespace|def)\\b.*", std::regex::icase);
    static const std::regex anyTagRegex("^@[a-zA-Z]+\\b.*");

    std::smatch match;
    if (std::regex_match(l, match, briefRegex) || std::regex_match(l, match, detailsRegex)) {
        return match[1].str();
    }
    if (std::regex_match(l, match, paramRegex)) {
        return match[1].str() + ": " + match[2].str();
    }
    if (std::regex_match(l, match, returnRegex)) {
        return S.returns + match[1].str();
    }
    if (std::regex_match(l, dropRegex) || std::regex_match(l, anyTagRegex)) {
        return ""; 
    }
    
    return l;
}

bool IsFunctionDeclaration(TSNode node, const std::string& code) {
    uint32_t count = ts_node_child_count(node);
    for (uint32_t i = 0; i < count; i++) {
        TSNode child = ts_node_child(node, i);
        const char* childType = ts_node_type(child);
        if (strcmp(childType, "function_declarator") == 0) return true;
        if (strcmp(childType, "pointer_declarator") == 0 || 
            strcmp(childType, "reference_declarator") == 0) {
            uint32_t subCount = ts_node_child_count(child);
            for (uint32_t j = 0; j < subCount; j++) {
                if (strcmp(ts_node_type(ts_node_child(child, j)), "function_declarator") == 0) return true;
            }
        }
    }
    return false;
}

class BriefGenerator {
public:
    std::vector<BriefEntity> entities;
    std::vector<Comment> comments;
    std::string code;
    const Strings& S;

    BriefGenerator(const Strings& strings) : S(strings) {}

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

    void ProcessObjectMember(const std::string& key, TSNode valueNode,
        const std::string& prefix, TSNode parentNode,
        int depth, bool isGetter = false, bool isSetter = false)
    {
        const char* valueType = ts_node_type(valueNode);

        if(strcmp(valueType, "method_definition") == 0 ||
            strcmp(valueType, "function_expression") == 0 ||
            strcmp(valueType, "arrow_function") == 0 ||
            strcmp(valueType, "generator_function") == 0)
        {

            std::string sig = "";
            TSNode body = { 0 };
            uint32_t methodCount = ts_node_child_count(valueNode);
            for(uint32_t k = 0; k < methodCount; k++)
            {
                TSNode methodChild = ts_node_child(valueNode, k);
                if(strcmp(ts_node_type(methodChild), "statement_block") == 0)
                {
                    body = methodChild;
                    break;
                }
            }

            if(!ts_node_is_null(body))
            {
                sig = code.substr(ts_node_start_byte(valueNode),
                    ts_node_start_byte(body) - ts_node_start_byte(valueNode));
            }
            else
            {
                sig = GetNodeText(valueNode, code);
            }

            sig = RemoveInlineCommentsFromSignature(sig);

            size_t parenIdx = sig.find('(');
            if(parenIdx != std::string::npos)
            {
                sig = key + sig.substr(parenIdx);
            }
            else
            {
                sig = key + "()";
            }

            BriefEntity e;
            if(isGetter) e.type = S.getterType;
            else if(isSetter) e.type = S.setterType;
            else e.type = S.methodType;

            e.prefix = prefix;
            e.signature = sig;
            e.startLine = ts_node_start_point(parentNode).row + 1;
            e.endLine = ts_node_end_point(parentNode).row + 1;
            e.startByte = ts_node_start_byte(parentNode);
            e.endByte = ts_node_end_byte(parentNode);
            entities.push_back(e);
        }
        else if(strcmp(valueType, "object") == 0)
        {
            // 1. СНАЧАЛА создаём запись для родительского поля
            std::string valueText = GetNodeText(valueNode, code);
            valueText = RemoveInlineCommentsFromSignature(valueText);

            BriefEntity parentField;
            parentField.type = S.fieldType;
            parentField.prefix = prefix;
            parentField.signature = key + " = " + valueText;
            parentField.startLine = ts_node_start_point(parentNode).row + 1;
            parentField.endLine = ts_node_end_point(parentNode).row + 1;
            parentField.startByte = ts_node_start_byte(parentNode);
            parentField.endByte = ts_node_end_byte(parentNode);
            entities.push_back(parentField);

            // 2. ПОТОМ рекурсивно обрабатываем содержимое (с точкой в префиксе!)
            std::string newPrefix = prefix.empty() ? key : prefix + "." + key;
            ProcessObjectLiteral(valueNode, newPrefix, depth + 1);
        }
        else
        {
            std::string valueText = GetNodeText(valueNode, code);
            valueText = RemoveInlineCommentsFromSignature(valueText);

            BriefEntity e;
            e.type = S.fieldType;
            e.prefix = prefix;
            e.signature = key + " = " + valueText;
            e.startLine = ts_node_start_point(parentNode).row + 1;
            e.endLine = ts_node_end_point(parentNode).row + 1;
            e.startByte = ts_node_start_byte(parentNode);
            e.endByte = ts_node_end_byte(parentNode);
            entities.push_back(e);
        }
    }

    void ProcessObjectLiteral(TSNode objectNode, const std::string& prefix, int depth = 0)
    {
        if(depth > 5) return;

        // Нормализуем префикс: добавляем точку, если не пустой
        std::string normalizedPrefix = prefix;
        if(!normalizedPrefix.empty() && normalizedPrefix.back() != '.')
        {
            normalizedPrefix += ".";
        }

        uint32_t count = ts_node_child_count(objectNode);
        for(uint32_t i = 0; i < count; i++)
        {
            TSNode child = ts_node_child(objectNode, i);
            const char* childType = ts_node_type(child);

            // СЛУЧАЙ 1: Обычная пара key: value
            if(strcmp(childType, "pair") == 0)
            {
                std::string key = "";
                TSNode valueNode = { 0 };

                uint32_t pairCount = ts_node_child_count(child);
                for(uint32_t j = 0; j < pairCount; j++)
                {
                    TSNode pairChild = ts_node_child(child, j);
                    const char* pairChildType = ts_node_type(pairChild);

                    if(strcmp(pairChildType, "property_identifier") == 0 ||
                        strcmp(pairChildType, "string") == 0 ||
                        strcmp(pairChildType, "identifier") == 0)
                    {
                        key = GetNodeText(pairChild, code);
                        // Убираем кавычки
                        if(key.length() >= 2 && (key.front() == '"' || key.front() == '\''))
                        {
                            key = key.substr(1, key.length() - 2);
                        }
                    }
                    else if(strcmp(pairChildType, ":") != 0)
                    {
                        valueNode = pairChild;
                    }
                }

                if(!key.empty() && !ts_node_is_null(valueNode))
                {
                    ProcessObjectMember(key, valueNode, normalizedPrefix, child, depth);
                }
            }
            // СЛУЧАЙ 2: Shorthand-метод напрямую
            else if(strcmp(childType, "method_definition") == 0)
            {
                std::string methodName = "";
                bool isGetter = false;
                bool isSetter = false;

                uint32_t methodCount = ts_node_child_count(child);
                for(uint32_t j = 0; j < methodCount; j++)
                {
                    TSNode mChild = ts_node_child(child, j);
                    std::string text = GetNodeText(mChild, code);
                    if(text == "get") isGetter = true;
                    else if(text == "set") isSetter = true;
                    else if(strcmp(ts_node_type(mChild), "property_identifier") == 0 ||
                        strcmp(ts_node_type(mChild), "identifier") == 0)
                    {
                        if(methodName.empty()) methodName = text;
                    }
                }

                if(!methodName.empty())
                {
                    ProcessObjectMember(methodName, child, normalizedPrefix, child, depth, isGetter, isSetter);
                }
            }
        }
    }

    void ProcessNode(TSNode node, const std::string& currentPrefix) {
        const char* type = ts_node_type(node);
        int startLine = ts_node_start_point(node).row + 1;
        int endLine = ts_node_end_point(node).row + 1;
        uint32_t startByte = ts_node_start_byte(node);
        uint32_t endByte = ts_node_end_byte(node);

        // ========== C++ ==========
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
            e.type = S.classType;
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
            
            if (!ts_node_is_null(body)) {
                sig = code.substr(startByte, ts_node_start_byte(body) - startByte);
            } else {
                sig = GetNodeText(node, code);
            }
            
            BriefEntity e;
            e.type = (currentPrefix.empty() ? S.functionType : S.methodType);
            e.prefix = currentPrefix;
            e.signature = RemoveInlineCommentsFromSignature(sig);
            e.startLine = startLine;
            e.endLine = endLine;
            e.startByte = startByte;
            e.endByte = endByte;
            entities.push_back(e);
        }
        else if (strcmp(type, "preproc_def") == 0 || strcmp(type, "preproc_function_def") == 0) {
            std::string text = GetNodeText(node, code);
            BriefEntity e;
            e.type = S.macroType;
            e.signature = RemoveInlineCommentsFromSignature(text);
            e.startLine = startLine;
            e.endLine = endLine;
            e.startByte = startByte;
            e.endByte = endByte;
            entities.push_back(e);
        }
        else if (strcmp(type, "alias_declaration") == 0 || strcmp(type, "type_definition") == 0) {
            std::string text = GetNodeText(node, code);
            BriefEntity e;
            e.type = S.typeAliasType;
            e.prefix = currentPrefix;
            e.signature = RemoveInlineCommentsFromSignature(text);
            e.startLine = startLine;
            e.endLine = startLine;
            e.startByte = startByte;
            e.endByte = endByte;
            entities.push_back(e);
        }
        else if (strcmp(type, "declaration") == 0 || strcmp(type, "field_declaration") == 0) {
            std::string text = GetNodeText(node, code);
            
            if (IsFunctionDeclaration(node, code)) {
                BriefEntity e;
                e.type = (currentPrefix.empty() ? S.functionType : S.methodType);
                e.prefix = currentPrefix;
                e.signature = RemoveInlineCommentsFromSignature(text);
                e.startLine = startLine;
                e.endLine = endLine;
                e.startByte = startByte;
                e.endByte = endByte;
                entities.push_back(e);
            } else {
                BriefEntity e;
                e.type = (currentPrefix.empty() ? S.constantType : S.fieldType);
                e.prefix = currentPrefix;
                e.signature = RemoveInlineCommentsFromSignature(text);
                e.startLine = startLine;
                e.endLine = endLine;
                e.startByte = startByte;
                e.endByte = endByte;
                entities.push_back(e);
            }
        }

        // ========== JS ==========
        else if (strcmp(type, "class_declaration") == 0) {
            std::string name = "";
            uint32_t count = ts_node_child_count(node);
            for (uint32_t i = 0; i < count; i++) {
                TSNode child = ts_node_child(node, i);
                if (strcmp(ts_node_type(child), "identifier") == 0 || strcmp(ts_node_type(child), "type_identifier") == 0) {
                    name = GetNodeText(child, code);
                    break;
                }
            }
            
            BriefEntity e;
            e.type = S.classType;
            e.prefix = currentPrefix;
            e.signature = name;
            e.startLine = startLine;
            e.endLine = endLine;
            e.startByte = startByte;
            e.endByte = endByte;
            entities.push_back(e);

            std::string newPrefix = currentPrefix + name + ".";
            for (uint32_t i = 0; i < count; i++) {
                ProcessNode(ts_node_child(node, i), newPrefix);
            }
        }
        else if (strcmp(type, "method_definition") == 0) {
            std::string sig = "";
            TSNode body = {0};
            uint32_t count = ts_node_child_count(node);
            for (uint32_t i = 0; i < count; i++) {
                TSNode child = ts_node_child(node, i);
                if (strcmp(ts_node_type(child), "statement_block") == 0) {
                    body = child;
                    break;
                }
            }
            
            if (!ts_node_is_null(body)) {
                sig = code.substr(startByte, ts_node_start_byte(body) - startByte);
            } else {
                sig = GetNodeText(node, code);
            }
            
            BriefEntity e;
            e.type = S.methodType;
            e.prefix = currentPrefix;
            e.signature = RemoveInlineCommentsFromSignature(sig);
            e.startLine = startLine;
            e.endLine = endLine;
            e.startByte = startByte;
            e.endByte = endByte;
            entities.push_back(e);
        }
        else if (strcmp(type, "function_declaration") == 0) {
            std::string funcName = "";
            TSNode body = {0};
            uint32_t count = ts_node_child_count(node);
            
            for (uint32_t i = 0; i < count; i++) {
                TSNode child = ts_node_child(node, i);
                const char* childType = ts_node_type(child);
                if (strcmp(childType, "identifier") == 0) {
                    funcName = GetNodeText(child, code);
                }
                if (strcmp(childType, "statement_block") == 0) {
                    body = child;
                }
            }
            
            // Проверяем, возвращает ли функция объект (фабрика)
            bool isFactory = false;
            TSNode returnObject = {0};
            
            if (!ts_node_is_null(body)) {
                uint32_t bodyCount = ts_node_child_count(body);
                for (uint32_t i = 0; i < bodyCount; i++) {
                    TSNode bodyChild = ts_node_child(body, i);
                    if (strcmp(ts_node_type(bodyChild), "return_statement") == 0) {
                        uint32_t returnCount = ts_node_child_count(bodyChild);
                        for (uint32_t j = 0; j < returnCount; j++) {
                            TSNode returnChild = ts_node_child(bodyChild, j);
                            if (strcmp(ts_node_type(returnChild), "object") == 0) {
                                isFactory = true;
                                returnObject = returnChild;
                                break;
                            }
                        }
                    }
                    if (isFactory) break;
                }
            }
            
            if(isFactory && !funcName.empty())
            {
                // 1. СНАЧАЛА добавляем саму функцию-фабрику
                std::string sig = "";
                if(!ts_node_is_null(body))
                {
                    sig = code.substr(startByte, ts_node_start_byte(body) - startByte);
                }
                else
                {
                    sig = GetNodeText(node, code);
                }

                BriefEntity factoryFunc;
                factoryFunc.type = S.functionType;
                factoryFunc.prefix = currentPrefix;
                factoryFunc.signature = RemoveInlineCommentsFromSignature(sig);
                factoryFunc.startLine = startLine;
                factoryFunc.endLine = endLine;
                factoryFunc.startByte = startByte;
                factoryFunc.endByte = endByte;
                entities.push_back(factoryFunc);

                // 2. ПОТОМ разбираем её содержимое
                std::string factoryPrefix = currentPrefix.empty() ? funcName : currentPrefix + "." + funcName;
                ProcessObjectLiteral(returnObject, factoryPrefix);
            } else {
                // Обычная функция
                std::string sig = "";
                if (!ts_node_is_null(body)) {
                    sig = code.substr(startByte, ts_node_start_byte(body) - startByte);
                } else {
                    sig = GetNodeText(node, code);
                }
                
                BriefEntity e;
                e.type = S.functionType;
                e.prefix = currentPrefix;
                e.signature = RemoveInlineCommentsFromSignature(sig);
                e.startLine = startLine;
                e.endLine = endLine;
                e.startByte = startByte;
                e.endByte = endByte;
                entities.push_back(e);
            }
        }
        else if (strcmp(type, "lexical_declaration") == 0 || strcmp(type, "variable_declaration") == 0) {
            uint32_t count = ts_node_child_count(node);
            bool hasFunction = false;
            
            for (uint32_t i = 0; i < count; i++) {
                TSNode child = ts_node_child(node, i);
                if (strcmp(ts_node_type(child), "variable_declarator") == 0) {
                    uint32_t subCount = ts_node_child_count(child);
                    for (uint32_t j = 0; j < subCount; j++) {
                        TSNode val = ts_node_child(child, j);
                        const char* valType = ts_node_type(val);
                        if (strcmp(valType, "arrow_function") == 0 || 
                            strcmp(valType, "function_expression") == 0 ||
                            strcmp(valType, "generator_function") == 0) {
                            hasFunction = true;
                            break;
                        }
                    }
                    if (hasFunction) break;
                }
            }
            
            if (hasFunction) {
                for (uint32_t i = 0; i < count; i++) {
                    TSNode child = ts_node_child(node, i);
                    if (strcmp(ts_node_type(child), "variable_declarator") == 0) {
                        std::string name = "";
                        TSNode valueNode = {0};
                        uint32_t subCount = ts_node_child_count(child);
                        for (uint32_t j = 0; j < subCount; j++) {
                            TSNode subChild = ts_node_child(child, j);
                            const char* subType = ts_node_type(subChild);
                            if (strcmp(subType, "identifier") == 0) {
                                name = GetNodeText(subChild, code);
                            } else if (strcmp(subType, "arrow_function") == 0 || 
                                       strcmp(subType, "function_expression") == 0 ||
                                       strcmp(subType, "generator_function") == 0) {
                                valueNode = subChild;
                            }
                        }
                        
                        if (!ts_node_is_null(valueNode)) {
                            std::string params = "";
                            uint32_t vCount = ts_node_child_count(valueNode);
                            for (uint32_t k = 0; k < vCount; k++) {
                                TSNode vChild = ts_node_child(valueNode, k);
                                if (strcmp(ts_node_type(vChild), "formal_parameters") == 0) {
                                    params = GetNodeText(vChild, code);
                                }
                            }
                            
                            std::string sig = name + params;
                            if (strcmp(ts_node_type(valueNode), "arrow_function") == 0) {
                                sig += " =>";
                            }
                            
                            BriefEntity e;
                            e.type = (currentPrefix.empty() ? S.functionType : S.methodType);
                            e.prefix = currentPrefix;
                            e.signature = RemoveInlineCommentsFromSignature(sig);
                            e.startLine = ts_node_start_point(child).row + 1;
                            e.endLine = ts_node_end_point(child).row + 1;
                            e.startByte = ts_node_start_byte(child);
                            e.endByte = ts_node_end_byte(child);
                            entities.push_back(e);
                        }
                    }
                }
            } else {
                std::string text = GetNodeText(node, code);
                BriefEntity e;
                e.type = (currentPrefix.empty() ? S.constantType : S.fieldType);
                e.prefix = currentPrefix;
                e.signature = RemoveInlineCommentsFromSignature(text);
                e.startLine = startLine;
                e.endLine = endLine;
                e.startByte = startByte;
                e.endByte = endByte;
                entities.push_back(e);
            }
        }

        if (strcmp(type, "translation_unit") == 0 || 
            strcmp(type, "linkage_specification") == 0 ||
            strcmp(type, "declaration_list") == 0 ||
            strcmp(type, "field_declaration_list") == 0 ||
            strcmp(type, "program") == 0 ||
            strcmp(type, "class_body") == 0 ||
            strcmp(type, "export_statement") == 0 ||
            strcmp(type, "export_default_declaration") == 0) {
            uint32_t count = ts_node_child_count(node);
            for (uint32_t i = 0; i < count; i++) {
                ProcessNode(ts_node_child(node, i), currentPrefix);
            }
        }
    }

    void AttachComments() {
        std::sort(comments.begin(), comments.end(), [](const Comment& a, const Comment& b) {
            return a.startByte < b.startByte;
        });

        for (auto& e : entities) {
            std::vector<std::string> topCommentTexts;
            std::string inlineComment = "";

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

            for (const auto& c : comments) {
                if (c.startLine == e.endLine && c.startByte > e.endByte) {
                    inlineComment = c.text;
                    break;
                }
            }

            if (inlineComment.empty() && (e.type == S.functionType || e.type == S.methodType)) {
                for (const auto& c : comments) {
                    if (c.startLine == e.startLine && c.startByte > e.startByte && c.startByte < e.endByte) {
                        inlineComment = c.text;
                        break;
                    }
                }
            }

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

                    std::string text = "";
                    bool isCommentLine = false;

                    if (l.substr(0, 3) == "///" || l.substr(0, 3) == "//!") {
                        text = TrimString(l.substr(3));
                        isCommentLine = true;
                    } else if (l.substr(0, 2) == "//") {
                        text = TrimString(l.substr(2));
                        isCommentLine = true;
                    } else if (l.find("/*") != std::string::npos) {
                        inBlockComment = true;
                        size_t startIdx = l.find("/*");
                        text = l.substr(startIdx + 2);
                        if (!text.empty() && (text[0] == '*' || text[0] == '!')) {
                            text = text.substr(1);
                        }
                        size_t endIdx = text.find("*/");
                        if (endIdx != std::string::npos) {
                            text = text.substr(0, endIdx);
                            inBlockComment = false;
                        }
                        text = TrimString(text);
                        isCommentLine = true;
                    } else if (l.find("*/") != std::string::npos) {
                        inBlockComment = false;
                        size_t endIdx = l.find("*/");
                        text = l.substr(0, endIdx);
                        if (!text.empty() && text[0] == '*') text = text.substr(1);
                        text = TrimString(text);
                        isCommentLine = true;
                    } else if (inBlockComment) {
                        text = l;
                        if (!text.empty() && text[0] == '*') text = text.substr(1);
                        text = TrimString(text);
                        isCommentLine = true;
                    }

                    if (isCommentLine && !text.empty()) {
                        std::string cleaned = CleanDoxygenLine(text, S);
                        if (!cleaned.empty()) {
                            cleanTop += cleaned + "\n";
                        }
                    }
                }
            }
            if (!cleanTop.empty() && cleanTop.back() == '\n') {
                cleanTop.pop_back();
            }

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
                
                std::istringstream iss(c);
                std::string line;
                std::vector<std::string> lines;
                while(std::getline(iss, line)) {
                    std::string trimmed = TrimString(line);
                    if (!trimmed.empty()) {
                        if (trimmed[0] == '*') trimmed = TrimString(trimmed.substr(1));
                        if (!trimmed.empty()) {
                            static const std::regex separatorRegex("^[=\\-*#~]+$");
                            if (!std::regex_match(trimmed, separatorRegex)) {
                                lines.push_back(trimmed);
                            }
                        }
                    }
                }
                for (const auto& l : lines) {
                    cleanInline += l + "\n";
                }
                if (!cleanInline.empty()) cleanInline.pop_back(); 
            }

            e.comment = "";
            if (!cleanTop.empty()) e.comment += cleanTop;
            if (!cleanInline.empty()) {
                if (!e.comment.empty()) e.comment += "\n";
                e.comment += cleanInline;
            }
        }
    }
};

std::string GenerateMarkdown(const std::string& filePath, const std::vector<BriefEntity>& entities, const Strings& S) {
    std::stringstream md;
    md << S.fileLabel << filePath << "\n\n";
    
    for (const auto& e : entities) {
        std::string prefix = e.prefix;
        std::string name = e.signature;
        
        std::string hashes = "#";
        if (e.type == S.methodType || e.type == S.fieldType || 
            e.type == S.getterType || e.type == S.setterType) {
            hashes = "##";
        }

        if (e.type == S.macroType) {
            md << hashes << " " << e.type << " " << name << "\n";
        } else {
            md << hashes << " " << e.type << ": " << prefix << name << "\n";
        }
        
        if (!e.comment.empty()) {
            md << e.comment << "\n";
        }
        
        if (e.startLine == e.endLine) {
            md << S.lineSingle << e.startLine << "\n\n";
        } else {
            md << S.lineRange << e.startLine << " - " << e.endLine << "\n\n";
        }
    }
    return md.str();
}

int main(int argc, char* argv[]) {
    std::setlocale(LC_ALL, ".65001");

    std::string inputPathStr;
    std::string outputPathStr;
    bool isRussian = false;

    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "-ru" || arg == "--ru") {
            isRussian = true;
        } else if (inputPathStr.empty()) {
            inputPathStr = arg;
        } else {
            outputPathStr = arg;
        }
    }

    const Strings& S = isRussian ? STRINGS_RU : STRINGS_EN;

    if (inputPathStr.empty()) {
        std::cerr << S.usage << "\n";
        return 1;
    }

    if (!S.langEnabled.empty()) {
        std::cout << S.langEnabled << "\n";
    }

    fs::path inputPath = inputPathStr;
    fs::path outputPath;

    if (!outputPathStr.empty()) {
        outputPath = outputPathStr;
        std::string outStr = outputPath.string();
        if (!outStr.empty() && (outStr.back() == '/' || outStr.back() == '\\')) {
            outputPath /= inputPath.filename().string() + ".brief.md";
        }
    } else {
        outputPath = inputPath;
        outputPath.replace_extension(inputPath.extension().string() + ".brief.md");
    }

    if (!fs::exists(inputPath)) {
        std::cerr << S.fileNotFound << inputPath << "\n";
        return 1;
    }

    std::string ext = inputPath.extension().string();
    const TSLanguage* lang = nullptr;
    bool isJS = false;
    
    if (ext == ".cpp" || ext == ".h" || ext == ".hpp" || ext == ".cc") {
        lang = tree_sitter_cpp();
    } else if (ext == ".js" || ext == ".jsx" || ext == ".ts") {
        lang = tree_sitter_javascript();
        isJS = true;
    } else {
        std::cerr << S.unsupportedExt << ext << "\n";
        return 1;
    }

    try {
        std::string code = ReadFileToUtf8String(inputPath);

        TSParser* parser = ts_parser_new();
        ts_parser_set_language(parser, lang);

        TSTree* tree = ts_parser_parse_string(parser, nullptr, code.c_str(), code.size());
        TSNode rootNode = ts_tree_root_node(tree);

        BriefGenerator gen(S);
        gen.code = code;
        gen.CollectComments(rootNode);
        gen.ProcessNode(rootNode, "");
        gen.AttachComments();

        std::string md = GenerateMarkdown(inputPath.filename().string(), gen.entities, S);
        WriteStringToFile(outputPath, md);

        std::cout << S.briefCreated << outputPath << "\n";

        ts_tree_delete(tree);
        ts_parser_delete(parser);

    } catch (const std::exception& e) {
        std::cerr << S.error << e.what() << "\n";
        return 1;
    }

    return 0;
}