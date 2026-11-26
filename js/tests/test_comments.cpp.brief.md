File: test_comments.cpp

# Macro #define MAX_VALUE 100
Это Doxygen-комментарий к макросу.
Он может быть многострочным.
Lines: 7 - 8

# Constant: const int GLOBAL_CONST = 42;
Это Doxygen-комментарий в стиле тройного слэша
Line: 10

# TypeAlias: using MyInt = int;
Обычный многострочный
комментарий к алиасу типа
Line: 14

# Class: TestClass
Класс для тестирования всех вариантов комментариев
Lines: 20 - 59

## Field: TestClass::int publicField;
Поле класса с Doxygen-комментарием
Line: 23

## Method: TestClass::TestClass();
Конструктор по умолчанию
Многострочный Doxygen с пустыми строками внутри.
Инлайн после объявления конструктора
Line: 30

## Method: TestClass::~TestClass();
Обычный однострочный комментарий над деструктором
Line: 33

## Method: TestClass::void normalMethod(int arg);
Doxygen-комментарий в стиле Qt (с восклицательным знаком)
arg: Параметр функции
Инлайн многострочный
комментарий после точки с запятой
Line: 39

## Method: TestClass::void oneLineMethod()
Метод, записанный в одну строку
Инлайн после однострочной функции
Line: 43

## Method: TestClass::int complexMethod( int arg1, int arg2 )
Сложный метод с переносом сигнатуры
Returns: Возвращаемое значение
Lines: 49 - 54

## Method: TestClass::void privateMethod();
Приватный метод
Line: 58

# Function: int globalFunction(int x, int y)
Глобальная функция с полным Doxygen-описанием
x: Первый параметр
y: Второй параметр
Returns: Сумма
Lines: 67 - 69

# Function: void shortFunc()
Глобальная функция в одну строку с инлайном
Короткий инлайн
Line: 72

# Function: void anotherFunc();
Функция с обычным многострочным комментарием
Line: 77

