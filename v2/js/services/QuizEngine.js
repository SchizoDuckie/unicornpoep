import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
// Import QuestionsManager
import questionsManager from './QuestionsManager.js';
import arrayUtils from '../utils/arrayUtils.js'; // Changed to default import
import { getTextTemplate } from '../utils/miscUtils.js'; // Import the utility
// REMOVED: Incorrect import
// import { DIFFICULTY_DURATIONS_MS } from '../core/game-constants.js';

/**
 * @typedef {object} Question
 * @property {string} question - The question text.
 * @property {string} answer - The correct answer text.
 * @property {string[]} [distractors] - Optional array of incorrect answer texts.
 * @property {string} [id] - Optional unique identifier for the question within its sheet.
 * @property {string} [sheetId] - The ID of the sheet this question belongs to.
 */

/**
 * @typedef {object} Sheet
 * @property {string} id - Unique identifier for the sheet.
 * @property {string} name - Display name of the sheet.
 * @property {boolean} isCustom - Whether the sheet is user-created.
 * @property {Question[]} questions - Array of questions in the sheet.
 */

/**
 * @typedef {object} HostQuestionsData
 * @property {Sheet[]} sheets - An array of sheet objects containing their questions.
 */

/**
 * @typedef {object} HostGameData
 * @property {HostQuestionsData} questionsData - The structured question data.
 * @property {string} difficulty - The difficulty level ('easy', 'medium', 'hard').
 */

// Define difficulty durations here or import from constants
const MAX_DISTRACTORS = 3; // Example constant

/**
 * Provides quiz data management and answer checking capabilities.
 * Can be instantiated to hold specific question sets.
 */
class QuizEngine {
    /**
     * Creates a new QuizEngine instance.
     */
    constructor() {
        // console.log("[QuizEngine] Instance created."); // Keep logging minimal for instances
        /** @type {Question[]} */
        this.questions = []; // Array of all loaded questions for this instance
        this.settings = null; // Store settings used for loading
        this.correctAnswerCount = 0; // Track correct answers internally for results
    }

    /**
     * [Factory Method] Creates and initializes a QuizEngine instance directly
     * from the data structure provided by the host.
     * @param {HostGameData} hostGameData - The data containing questionsData and difficulty.
     * @returns {QuizEngine} A new, populated QuizEngine instance.
     * @throws {Error} If hostGameData is invalid or contains no questions.
     */
    static createInstance(hostGameData) {
        if (!hostGameData || !hostGameData.questionsData || !hostGameData.difficulty) {
            throw new Error("Invalid host data provided to create QuizEngine instance.");
        }
        const newEngine = new QuizEngine();
        newEngine._loadDataFromHost(hostGameData); // Use internal method to load
        console.log(`[QuizEngine] Created instance from host data. ${newEngine.getQuestionCount()} questions loaded.`);
        return newEngine;
    }
    
    /**
     * [Singleton Access - Legacy Support] Gets the shared singleton instance.
     * NOTE: Prefer creating instances for isolated game modes (like MP client).
     * @returns {QuizEngine} The singleton instance.
     */
    static getInstance() {
        if (!QuizEngine._instance) {
            QuizEngine._instance = new QuizEngine();
            console.log("[QuizEngine] Singleton instance created.");
        }
        return QuizEngine._instance;
    }

    /**
     * [Internal] Loads question data from the host-provided structure.
     * @param {HostGameData} hostGameData
     * @private
     */
    _loadDataFromHost(hostGameData) {
        this.settings = { difficulty: hostGameData.difficulty }; // Store difficulty
        this.questions = [];
        this.correctAnswerCount = 0;

        if (!hostGameData.questionsData.sheets || hostGameData.questionsData.sheets.length === 0) {
             throw new Error("Host questions data contains no sheets.");
        }

        let allLoadedQuestions = [];
        for (const sheet of hostGameData.questionsData.sheets) {
            if (sheet.questions && sheet.questions.length > 0) {
                 // Assume questions have { question, answer }, add sheetId for context
                const processedQuestions = sheet.questions.map(q => ({ ...q, sheetId: sheet.id }));
                allLoadedQuestions = allLoadedQuestions.concat(processedQuestions);
            }
        }

        if (allLoadedQuestions.length === 0) {
             throw new Error("No valid questions found in host data sheets.");
        }
        
        // Shuffle the combined list
        this.questions = arrayUtils.shuffleArray(allLoadedQuestions);
    }

    /**
     * [For Singleton/Host Use] Loads and shuffles questions using QuestionsManager.
     * @param {string[]} sheetIds - Array of sheet IDs to load questions from.
     * @param {string} [difficulty='medium'] - Difficulty level.
     * @returns {Promise<void>}
     * @throws {Error} If no questions could be loaded.
     */
    async loadQuestionsFromManager(sheetIds, difficulty = 'medium') {
        // This method is primarily for the singleton instance or host
        console.log(`[QuizEngine Instance] Loading questions via Manager for sheets: ${sheetIds.join(', ')}`);
        this.settings = { sheetIds, difficulty };
        this.questions = [];
        this.correctAnswerCount = 0;

        eventBus.emit(Events.System.LoadingStart, { message: getTextTemplate('qeLoading') });
        try {
            let allLoadedQuestions = [];
            for (const sheetId of sheetIds) {
                try {
                    const sheetQuestions = await questionsManager.getQuestionsForSheet(sheetId);
                    if (sheetQuestions && sheetQuestions.length > 0) {
                        const processedQuestions = sheetQuestions.map(q => ({ ...q, sheetId: q.sheetId || sheetId }));
                        allLoadedQuestions = allLoadedQuestions.concat(processedQuestions);
                        console.log(`[QuizEngine Instance] Loaded ${sheetQuestions.length} questions from ${sheetId}`);
                    } else {
                        console.warn(`[QuizEngine Instance] No questions found or loaded for sheet: ${sheetId}`);
                    }
                } catch (error) {
                    console.error(`[QuizEngine Instance] Error processing questions from sheet ${sheetId}:`, error);
                    throw error;
                }
            }

            if (allLoadedQuestions.length === 0) {
                throw new Error(getTextTemplate('qeLoadError'));
            }

            this.questions = arrayUtils.shuffleArray(allLoadedQuestions);
            console.log(`[QuizEngine Instance] Total ${this.questions.length} questions loaded and shuffled.`);

        } finally {
            eventBus.emit(Events.System.LoadingEnd);
        }
    }

    // --- Core Quiz Methods (Operate on this.questions) ---

    /** Returns the total number of questions loaded. */
    getQuestionCount() {
        return this.questions.length;
    }

    /** Retrieves question data by index. */
    getQuestionData(index) {
        if (index < 0 || index >= this.questions.length) {
            return null;
        }
        return { ...this.questions[index] }; // Return shallow copy
    }

    /** Gets the correct answer text by index. */
    getCorrectAnswer(index) {
        const question = this.getQuestionData(index);
        return question ? question.answer : null;
    }

    /** Generates and shuffles answers (correct + distractors) by index. */
    getShuffledAnswers(index) {
        const currentQuestion = this.getQuestionData(index);
        if (!currentQuestion) return [];

        const correctAnswer = currentQuestion.answer;
        let allAnswers = [correctAnswer];

        if (Array.isArray(currentQuestion.distractors) && currentQuestion.distractors.length > 0) {
            allAnswers = allAnswers.concat(currentQuestion.distractors);
        } else {
            // Generate simple distractors from other answers in this instance's pool
            const otherAnswers = this.questions
                .map(q => q.answer)
                .filter((ans, idx) => typeof ans === 'string' && ans.trim().toLowerCase() !== correctAnswer.trim().toLowerCase() && idx !== index)
                .filter((ans, pos, self) => self.findIndex(a => a.trim().toLowerCase() === ans.trim().toLowerCase()) === pos) // Unique distractors
                .slice(0, MAX_DISTRACTORS);

             if (otherAnswers.length > 0) {
                  allAnswers = allAnswers.concat(otherAnswers);
             } else {
                   console.warn(`[QuizEngine Instance] Could not generate distractors for question ${index}.`);
             }
        }
        return arrayUtils.shuffleArray(allAnswers);
    }

    /** Checks a submitted answer, performs comparison, updates internal count. */
    checkAnswer(index, submittedAnswer) {
        const question = this.getQuestionData(index);
        if (!question) {
            return { isCorrect: false, correctAnswer: null };
        }
        const correctAnswer = question.answer;
        let isCorrect = false;
        if (typeof submittedAnswer === 'string' && typeof correctAnswer === 'string') {
            isCorrect = submittedAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
        }
        if (isCorrect) {
             this.correctAnswerCount++;
        }
        return { isCorrect: isCorrect, correctAnswer: correctAnswer };
    }

    /** Checks if the quiz is complete based on the next index. */
     isQuizComplete(nextIndex) {
         return nextIndex >= this.questions.length;
     }

     /** Gets the count of correctly answered questions. */
      getCorrectCount() {
          return this.correctAnswerCount;
      }

      // --- Private helper for distractor generation (if needed, currently inline) ---
      // _generateDistractors(...)
}

// Initialize the singleton instance variable for legacy access method
QuizEngine._instance = null;

// Export the class itself, allowing instantiation
export default QuizEngine; 