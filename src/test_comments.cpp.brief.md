File: test_comments.cpp

# Macro #define MAX_VALUE 100 // Инлайн-комментарий к макросу
Это Doxygen-комментарий к макросу.
Он может быть многострочным.
Стр: 7 - 8

# Constant: const int GLOBAL_CONST = 42;
Это Doxygen-комментарий в стиле тройного слэша
Стр: 10

# TypeAlias: using MyInt = int;
Обычный многострочный
комментарий к алиасу типа
Стр: 14

# Class: TestClass
@brief Класс для тестирования всех вариантов комментариев
@author Test
Стр: 20 - 59

# Constant: TestClass::TestClass();
@brief Конструктор по умолчанию
Многострочный Doxygen с пустыми строками внутри. | Инлайн после объявления конструктора
Стр: 30

# Constant: TestClass::~TestClass();
Обычный однострочный комментарий над деструктором
Стр: 33

## Method: TestClass::void oneLineMethod()
Метод, записанный в одну строку | тело
Стр: 43

## Method: TestClass::int complexMethod( int arg1, int arg2 )
Сложный метод с переносом сигнатуры
@return Возвращаемое значение
Стр: 49 - 54

## Function: int globalFunction(int x, int y)
Глобальная функция с полным Doxygen-описанием
@param x Первый параметр
@param y Второй параметр
@return Сумма
Стр: 67 - 69

## Function: void shortFunc()
Глобальная функция в одну строку с инлайном | Короткий инлайн
Стр: 72

# Constant: void anotherFunc();
Функция с обычным многострочным комментарием
Стр: 77

