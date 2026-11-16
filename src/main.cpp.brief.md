File: main.cpp

# Constant: const TSLanguage *tree_sitter_cpp(void);
Стр: 14

# Constant: const TSLanguage *tree_sitter_javascript(void);
Стр: 15

# Class: BriefEntity
Стр: 19 - 28

# Class: Comment
Стр: 30 - 36

## Function: std::string ReadFileToUtf8String(const fs::path& filePath)
Стр: 38 - 54

## Function: void WriteStringToFile(const fs::path& filePath, const std::string& content)
Стр: 56 - 62

## Function: std::string GetNodeText(TSNode node, const std::string& code)
Стр: 64 - 71

## Function: std::string CleanUpSignature(const std::string& rawSig)
Стр: 73 - 84

## Function: std::string TrimString(const std::string& s)
FIX: Добавлена вспомогательная функция для тримминга строк
Стр: 87 - 92

# Class: BriefGenerator
Стр: 94 - 363

## Method: BriefGenerator::void CollectComments(TSNode node)
Стр: 100 - 114

## Method: BriefGenerator::void ProcessNode(TSNode node, const std::string& currentPrefix)
Стр: 116 - 245

## Method: BriefGenerator::void AttachComments()
Стр: 247 - 362

## Function: std::string GenerateMarkdown(const std::string& filePath, const std::vector<BriefEntity>& entities)
Стр: 365 - 394

## Function: int main(int argc, char* argv[])
Стр: 396 - 463

