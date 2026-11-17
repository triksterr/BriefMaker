Файл: main.cpp

# Функция: const TSLanguage *tree_sitter_cpp(void);
Стр: 14

# Функция: const TSLanguage *tree_sitter_javascript(void);
Стр: 15

# Класс: Strings
Стр: 22 - 47

## Поле: Strings::std::string fileLabel;
Markdown labels
Стр: 24

## Поле: Strings::std::string classType;
Стр: 25

## Поле: Strings::std::string methodType;
Стр: 26

## Поле: Strings::std::string functionType;
Стр: 27

## Поле: Strings::std::string macroType;
Стр: 28

## Поле: Strings::std::string constantType;
Стр: 29

## Поле: Strings::std::string typeAliasType;
Стр: 30

## Поле: Strings::std::string fieldType;
Стр: 31

## Поле: Strings::std::string lineSingle;
Line numbers
e.g. "Line: " or "Стр: "
Стр: 34

## Поле: Strings::std::string lineRange;
e.g. "Line: " or "Стр: "
e.g. "Lines: " or "Стр: "
Стр: 35

## Поле: Strings::std::string returns;
Doxygen
"Returns: " or "Возвращает: "
Стр: 38

## Поле: Strings::std::string usage;
Console messages
Стр: 41

## Поле: Strings::std::string fileNotFound;
Стр: 42

## Поле: Strings::std::string unsupportedExt;
Стр: 43

## Поле: Strings::std::string briefCreated;
Стр: 44

## Поле: Strings::std::string error;
Стр: 45

## Поле: Strings::std::string langEnabled;
Стр: 46

# Константа: const Strings STRINGS_EN = { "File: ", "Class", "Method", "Function", "Macro", "Constant", "TypeAlias", "Field", "Line: ", "Lines: ", "Returns: ", "Usage: BriefMaker.exe <input_file> [output_path] [-ru]", "File not found: ", "Unsupported extension: ", "Brief successfully created: ", "Error: ", ""
Стр: 49 - 60

# Константа: const Strings STRINGS_RU = { "Файл: ", "Класс", "Метод", "Функция", "Макрос", "Константа", "Псевдоним типа", "Поле", "Стр: ", "Стр: ", "Возвращает: ", "Использование: BriefMaker.exe <входной_файл> [путь_вывода] [-ru]", "Файл не найден: ", "Неподдерживаемое расширение: ", "Бриф успешно создан: ", "Ошибка: ", "Включён русский язык интерфейса." };
Стр: 62 - 73

# Класс: BriefEntity
Стр: 78 - 87

## Поле: BriefEntity::std::string type;
Стр: 79

## Поле: BriefEntity::std::string prefix;
Стр: 80

## Поле: BriefEntity::std::string signature;
Стр: 81

## Поле: BriefEntity::std::string comment;
Стр: 82

## Поле: BriefEntity::int startLine;
Стр: 83

## Поле: BriefEntity::int endLine;
Стр: 84

## Поле: BriefEntity::uint32_t startByte;
Стр: 85

## Поле: BriefEntity::uint32_t endByte;
Стр: 86

# Класс: Comment
Стр: 89 - 95

## Поле: Comment::std::string text;
Стр: 90

## Поле: Comment::int startLine;
Стр: 91

## Поле: Comment::int endLine;
Стр: 92

## Поле: Comment::uint32_t startByte;
Стр: 93

## Поле: Comment::uint32_t endByte;
Стр: 94

# Функция: std::string ReadFileToUtf8String(const fs::path& filePath)
Стр: 100 - 116

# Функция: void WriteStringToFile(const fs::path& filePath, const std::string& content)
Стр: 118 - 124

# Функция: std::string GetNodeText(TSNode node, const std::string& code)
Стр: 126 - 133

# Функция: std::string TrimString(const std::string& s)
Стр: 135 - 140

# Функция: std::string RemoveInlineCommentsFromSignature(const std::string& rawSig)
Стр: 142 - 174

# Функция: std::string CleanDoxygenLine(const std::string& line, const Strings& S)
Стр: 176 - 206

# Функция: bool IsFunctionDeclaration(TSNode node, const std::string& code)
Стр: 208 - 223

# Класс: BriefGenerator
Стр: 228 - 715

## Поле: BriefGenerator::std::vector<BriefEntity> entities;
Стр: 230

## Поле: BriefGenerator::std::vector<Comment> comments;
Стр: 231

## Поле: BriefGenerator::std::string code;
Стр: 232

## Поле: BriefGenerator::const Strings& S;
Стр: 233

## Метод: BriefGenerator::BriefGenerator(const Strings& strings) : S(strings)
Стр: 235

## Метод: BriefGenerator::void CollectComments(TSNode node)
Стр: 237 - 251

## Метод: BriefGenerator::void ProcessNode(TSNode node, const std::string& currentPrefix)
Стр: 253 - 560

## Метод: BriefGenerator::void AttachComments()
Стр: 562 - 714

# Функция: std::string GenerateMarkdown(const std::string& filePath, const std::vector<BriefEntity>& entities, const Strings& S)
Стр: 717 - 747

# Функция: int main(int argc, char* argv[])
Стр: 752 - 844

