// Тестовый файл для JavaScript

/**
 * Глобальная константа
 */
const MAX_USERS = 100; // Инлайн к константе

/**
 * Обычная глобальная функция
 * @param {string} name Имя пользователя
 */
function greetUser(name) {
    return "Hello " + name;
}

// Стрелочная функция
const calculateSum = (a, b) => {
    return a + b;
};

/**
 * Класс пользователя
 */
class User {
    /**
     * Конструктор
     * @param {string} name 
     */
    constructor(name) {
        this.name = name;
    }

    /// Метод получения имени
    getName() {
        return this.name;
    }

    static staticMethod() {
        return "static";
    }
}

export const exportedVar = 42;

export default class DefaultClass {
    method() {}
}