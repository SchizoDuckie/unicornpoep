/**
 * This class represents a sheet within the questionsManager,
 * containing questions and answers for the game.
 */
class QuestionSheet {
    /**
     * Constructs the QuestionSheet instance.
     * 
     * @param {QuestionsManager} questionsManager The questionsManager instance for interacting with Google Sheets.
     * @param {string} sheetName The name of the sheet containing questions and answers.
     */
    constructor(questionsManager, sheetName) {
        this.questionsManager = questionsManager;
        this.sheetName = sheetName;
        this.questions = []; // Array to store questions and answers
    }

    /**
     * Fetches questions and answers from the sheet and stores them in the questions array.
     */
    async fetchQuestions() {
        try {
            this.questions  = await this.questionsManager.readSheet(this.sheetName);
        } catch (error) {
            console.error(`Error fetching questions from sheet "${this.sheetName}": `, error);
        }
    }

    /**
     * Randomly selects a question that has not been asked yet.
     * 
     * @returns {Object|null} An object containing the question and its answer, or null if all questions have been asked.
     */
    getRandomQuestion() {
        if (this.questions.length === 0) {
            console.warn('No questions available.');
            return null;
        }

        const randomIndex = Math.floor(Math.random() * this.questions.length);
        return this.questions.splice(randomIndex, 1)[0];
    }

    // Additional methods as needed
}
