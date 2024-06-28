/**
 * Manages the loading, parsing, and storage of question sets for the game.
 * Handles both predefined and custom question sets.
 */
class QuestionsManager {
    /**
     * Initializes the QuestionsManager.
     */
    constructor() {
        /** @type {Object.<string, Object>} Cache for storing fetched questions */
        this.questionsCache = {};
        /** @type {boolean} Flag indicating if initialization is complete */
        this.isInitialized = false;
    }

    /**
     * Initializes the manager by fetching and parsing questions from specified files.
     * @param {string[]} filePaths - An array of paths to the text files containing questions.
     * @returns {Promise<void>}
     */
    async init(filePaths) {
        try {
            for (const filePath of filePaths) {
                const response = await fetch(filePath);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const text = await response.text();
                this.questionsCache[filePath] = this.parseQuestions(text);
            }
            this.isInitialized = true;
        } catch (error) {
            console.error(`Error fetching questions from files: `, error);
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * Waits for the initialization to complete.
     * @returns {Promise<void>}
     */
    async waitForInitialisation() {
        while (!this.isInitialized) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * Parses the text content into a structured object of questions and answers.
     * @param {string} text - The text content containing questions and answers.
     * @returns {Object.<string, Array<{question: string, answer: string}>>}
     */
    parseQuestions(text) {
        const categories = text.replace(/\r/g, '').trim().split('\n\n');
        const questionsData = {};

        categories.forEach(categoryBlock => {
            const lines = categoryBlock.split('\n');
            const title = lines.shift().trim().replace(':', '');
            questionsData[title] = lines.map(line => {
                const [question, answer] = line.trim().split('=>').map(s => s.trim());
                return { question, answer };
            });
        });

        return questionsData;
    }

    listSheets() {
        const predefinedSheets = Object.values(this.questionsCache)
            .flatMap(fileContent => Object.keys(fileContent));
        const customSheets = this.listCustomSheets();
        const allSheets = [...new Set([...predefinedSheets, ...customSheets])];
        console.log('All available sheets:', allSheets);
        return allSheets;
    }

    /**
     * Lists all custom question sheets.
     * @returns {string[]} An array of custom sheet names.
     */
    listCustomSheets() {
        const customSheets = JSON.parse(localStorage.getItem('customSheets')) || {};
        return Object.keys(customSheets);
    }

    /**
     * Reads questions from a specified sheet.
     * @param {string} sheetName - The name of the sheet to read questions from.
     * @returns {Promise<Array<{question: string, answer: string}>>}
     */
    async readSheet(sheetName) {
        const customQuestions = this.getCustomQuestions(sheetName);
        if (customQuestions) {
            return customQuestions;
        }

        for (const fileContent of Object.values(this.questionsCache)) {
            if (fileContent[sheetName]) {
                return fileContent[sheetName];
            }
        }
        throw new Error(`Sheet "${sheetName}" not found`);
    }

    /**
     * Saves a set of custom questions.
     * @param {string} sheetName - The name of the custom sheet.
     * @param {string} customText - The text content of custom questions.
     */
    saveCustomQuestions(sheetName, customText) {
        const questions = customText.split('\n').map(line => {
            const [question, answer] = line.split('=>').map(part => part.trim());
            return { question, answer };
        });
        const customSheets = JSON.parse(localStorage.getItem('customSheets')) || {};
        customSheets[sheetName] = questions;
        localStorage.setItem('customSheets', JSON.stringify(customSheets));
    }
    /**
     * Retrieves a set of custom questions.
     * @param {string} sheetName - The name of the custom sheet.
     * @returns {Array<{question: string, answer: string}>|null}
     */
    getCustomQuestions(sheetName) {
        const customSheets = JSON.parse(localStorage.getItem('customSheets')) || {};
        return customSheets[sheetName] || null;
    }

    /**
     * Deletes a set of custom questions.
     * @param {string} sheetName - The name of the custom sheet to delete.
     */
    deleteCustomQuestions(sheetName) {
        const customSheets = JSON.parse(localStorage.getItem('customSheets')) || {};
        delete customSheets[sheetName];
        localStorage.setItem('customSheets', JSON.stringify(customSheets));
    }
}