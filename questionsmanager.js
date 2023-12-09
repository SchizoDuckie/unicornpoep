/**
 * This class manages question sets and highscores for the game.
 * It allows fetching of questions from text files and handling of highscores using local storage.
 */
class QuestionsManager {
    constructor() {
        this.questionsCache = {}; // Cache for storing fetched questions
        this.isInitialized = false;
    }

    /**
     * Fetches questions from specified text files and initializes the manager.
     *
     * @param {Array} filePaths An array of paths to the text files containing questions.
     */
    async init(filePaths) {
        try {
            for (const filePath of filePaths) {
                const response = await fetch(filePath);
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
     *
     * @returns {Promise} A promise that resolves when the manager is initialized.
     */
    async waitForInitialisation() {
        while (!this.isInitialized) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for 100ms before checking again
        }
    }

    /**
     * Parses the text content into a structured array of questions and answers.
     *
     * @param {string} text The text content containing questions and answers.
     * @returns {Object} An object with categories as keys and question-answer pairs as values.
     */
    parseQuestions(text) {

        const categories = text.replace(/\r/g, '').trim().split('\n\n');
        const questionsData = {};

        categories.forEach(categoryBlock => {
            const lines = categoryBlock.split('\n');
            const title = lines.shift().trim().replace(':', ''); // Remove colon from title
            questionsData[title] = lines.map(line => {
                const [question, answer] = line.trim().split('\t');
                return { question, answer };
            });
        });

        return questionsData;
    }

       /**
     * Lists all categories of questions available.
     * 
     * @returns {Array} An array of category names.
     */
    listSheets() {
       const allSheets = [];
       for (const fileContent of Object.values(this.questionsCache)) {
           allSheets.push(...Object.keys(fileContent));
       }
       return allSheets;
    }

    /**
     * Reads questions from a specified category across all cached files.
     *
     * @param {string} sheetName The name of the category to read questions from.
     * @returns {Promise<Array>} A promise that resolves to an array of question-answer pairs.
     */
    readSheet(sheetName) {
        for (const fileContent of Object.values(this.questionsCache)) {
            if (fileContent[sheetName]) {
                return Promise.resolve(fileContent[sheetName]);
            }
        }
        return Promise.reject(new Error(`Sheet "${sheetName}" not found in any file`));
    }


}
