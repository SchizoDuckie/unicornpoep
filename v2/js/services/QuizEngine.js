import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
// Import QuestionsManager
import questionsManager from './QuestionsManager.js';
import arrayUtils from '../utils/arrayUtils.js'; // Changed to default import
import { getTextTemplate } from '../utils/miscUtils.js'; // Import the utility

/**
 * @typedef {object} Question
 * @property {string} question - The question text.
 * @property {string} answer - The correct answer text.
 * @property {string[]} [distractors] - Optional array of incorrect answer texts.
 * @property {string} [id] - Optional unique identifier for the question within its sheet.
 * @property {string} [sheetId] - The ID of the sheet this question belongs to.
 */

/**
 * Provides quiz data management and answer checking capabilities.
 * It loads and holds questions for a quiz round but does not manage game state
 * (like current index or score). Game mode classes use this service.
 */
class QuizEngine {
    /**
     * Creates a new QuizEngine instance.
     */
    constructor() {
        console.log("[QuizEngine] Initializing passive service instance.");
        /** @type {Question[]} */
        this.questions = []; // Array of all loaded questions for the current quiz round
        this.settings = null; // Store settings used for loading
        this.correctAnswerCount = 0; // Track correct answers internally for results
    }

    /**
     * Loads and shuffles questions from the specified sheet IDs and difficulty.
     * Stores the loaded questions internally.
     * @param {string[]} sheetIds - Array of sheet IDs to load questions from.
     * @param {string} [difficulty='medium'] - Difficulty level (currently unused by engine).
     * @returns {Promise<void>}
     * @throws {Error} If no questions could be loaded.
     */
    async loadQuestions(sheetIds, difficulty = 'medium') {
        console.log(`[QuizEngine] Loading questions for sheets: ${sheetIds.join(', ')}`);
        // Store settings for potential later use (e.g., difficulty affecting distractors)
        this.settings = { sheetIds, difficulty };
        // Reset internal state for new load
        this.questions = [];
        this.correctAnswerCount = 0;

        // Use template for loading message
        eventBus.emit(Events.System.LoadingStart, { message: getTextTemplate('qeLoading') });
        try {
            let allLoadedQuestions = [];

            for (const sheetId of sheetIds) {
                try {
                    const sheetQuestions = await questionsManager.getQuestionsForSheet(sheetId);
                    if (sheetQuestions && sheetQuestions.length > 0) {
                        // Add sheetId context if not already present
                        const processedQuestions = sheetQuestions.map(q => ({ ...q, sheetId: q.sheetId || sheetId }));
                        allLoadedQuestions = allLoadedQuestions.concat(processedQuestions);
                        console.log(`[QuizEngine] Loaded ${sheetQuestions.length} questions from ${sheetId}`);
                    } else {
                        console.warn(`[QuizEngine] No questions found or loaded for sheet: ${sheetId}`);
                    }
                } catch (error) {
                    console.error(`[QuizEngine] Error processing questions from sheet ${sheetId}:`, error);
                    // Re-throw or decide if partial load is acceptable
                    throw error; // Fail hard if any sheet fails for now
                }
            }

            if (allLoadedQuestions.length === 0) {
                // Use template for error message
                throw new Error(getTextTemplate('qeLoadError'));
            }

            // Shuffle the combined list of questions
            this.questions = arrayUtils.shuffleArray(allLoadedQuestions);
            console.log(`[QuizEngine] Total ${this.questions.length} questions loaded and shuffled.`);

        } finally {
            eventBus.emit(Events.System.LoadingEnd);
        }
    }

    /**
     * Returns the total number of questions loaded for this round.
     * @returns {number}
     */
    getQuestionCount() {
        return this.questions.length;
    }

    /**
     * Retrieves the question data for a specific index.
     * @param {number} index - The 0-based index of the question.
     * @returns {Question | null} The question object or null if index is out of bounds.
     */
    getQuestionData(index) {
        if (index < 0 || index >= this.questions.length) {
            console.warn(`[QuizEngine] getQuestionData called with invalid index: ${index}`);
            return null;
        }
        // Return a copy to prevent accidental modification? Deep copy might be needed if nested objects are modified.
        // For now, shallow copy assuming question structure is simple.
        return { ...this.questions[index] };
    }

    /**
     * Gets the correct answer text for a specific question index.
     * @param {number} index - The 0-based index of the question.
     * @returns {string | null} The correct answer text or null if index is invalid.
     */
    getCorrectAnswer(index) {
        const question = this.getQuestionData(index);
        return question ? question.answer : null;
    }

    /**
     * Generates and shuffles a list of potential answers for a given question index,
     * including the correct answer and distractors (if available).
     * @param {number} index - The 0-based index of the question.
     * @returns {string[]} An array of shuffled answer strings, or empty array if index is invalid.
     */
    getShuffledAnswers(index) {
        const currentQuestion = this.getQuestionData(index);
        if (!currentQuestion) {
            return [];
        }

        const correctAnswer = currentQuestion.answer;
        let allAnswers = [correctAnswer];

        // Add provided distractors
        if (Array.isArray(currentQuestion.distractors) && currentQuestion.distractors.length > 0) {
            allAnswers = allAnswers.concat(currentQuestion.distractors);
        } else {
            // Generate simple distractors from other answers in the pool if none provided
            console.warn(`[QuizEngine] Question ${index} has no distractors. Generating simple ones.`);
            const otherAnswers = this.questions
                .map(q => q.answer)
                // Filter out the correct answer and potential duplicates, ensure defined
                .filter((ans, idx) => typeof ans === 'string' && ans.trim().toLowerCase() !== correctAnswer.trim().toLowerCase() && idx !== index)
                 // Remove duplicates from potential distractors
                .filter((ans, pos, self) => self.findIndex(a => a.trim().toLowerCase() === ans.trim().toLowerCase()) === pos)
                .slice(0, 3); // Limit to max 3 distractors

            // Only add if we found any suitable distractors
             if (otherAnswers.length > 0) {
                  allAnswers = allAnswers.concat(otherAnswers);
             } else {
                  console.warn(`[QuizEngine] Could not generate distractors for question ${index}. Only correct answer will be shown.`);
             }
        }

        return arrayUtils.shuffleArray(allAnswers);
    }

    /**
     * Checks a submitted answer against the correct answer for a given question index.
     * Performs case-insensitive comparison after trimming whitespace.
     * Increments internal correct answer count if correct.
     * @param {number} index - The 0-based index of the question to check against.
     * @param {string} submittedAnswer - The answer submitted by the player.
     * @returns {{isCorrect: boolean, correctAnswer: string | null}} An object indicating if the answer was correct and the correct answer text.
     */
    checkAnswer(index, submittedAnswer) {
        const question = this.getQuestionData(index);
        if (!question) {
            console.error(`[QuizEngine] checkAnswer called for invalid index: ${index}`);
            return { isCorrect: false, correctAnswer: null };
        }

        const correctAnswer = question.answer;
        let isCorrect = false;

        // Perform case-insensitive comparison after trimming
        if (typeof submittedAnswer === 'string' && typeof correctAnswer === 'string') {
            isCorrect = submittedAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
        } else {
            // Handle non-string comparison? For now, treat as incorrect.
            console.warn(`[QuizEngine] Comparing non-string answers for index ${index}: Submitted='${submittedAnswer}', Correct='${correctAnswer}'`);
        }

        if (isCorrect) {
             this.correctAnswerCount++;
             console.log(`[QuizEngine] Answer for index ${index} is CORRECT. Total correct: ${this.correctAnswerCount}`);
        } else {
            console.log(`[QuizEngine] Answer for index ${index} is INCORRECT.`);
        }

        return { isCorrect: isCorrect, correctAnswer: correctAnswer };
    }
    
    /**
     * Checks if the quiz is complete based on the next potential index.
     * @param {number} nextIndex - The index of the *next* question to be attempted.
     * @returns {boolean} True if the nextIndex is out of bounds, false otherwise.
     */
     isQuizComplete(nextIndex) {
         return nextIndex >= this.questions.length;
     }

     /**
      * Gets the count of correctly answered questions tracked internally.
      * @returns {number}
      */
      getCorrectCount() {
          return this.correctAnswerCount;
      }

    /**
     * Generates distractor answers for a given correct answer.
     * Tries to find related answers from the same sheet first.
     * @param {string} correctAnswer - The correct answer.
     * @param {string} currentSheetId - The sheet ID of the current question.
     * @returns {string[]}
     * @private
     */
    _generateDistractors(correctAnswer, currentSheetId) {
        const distractors = new Set();

        // Filter all loaded questions to find potential distractors
        const allAnswers = this.questions.map(q => q.a);
        const uniqueAnswers = [...new Set(allAnswers)];

        // Prioritize answers from the same sheet (if possible and desired)
        const sameSheetAnswers = this.questions
            .filter(q => q.sheetId === currentSheetId && q.a !== correctAnswer)
            .map(q => q.a);
        const uniqueSameSheetAnswers = [...new Set(sameSheetAnswers)];

        // Attempt to fill with same-sheet distractors first
        arrayUtils.shuffleArray(uniqueSameSheetAnswers); // Use shuffleArray from arrayUtils
        for (const answer of uniqueSameSheetAnswers) {
            if (distractors.size >= MAX_DISTRACTORS) break;
            if (answer !== correctAnswer) {
                distractors.add(answer);
            }
        }

        // If not enough distractors, fill with answers from other sheets
        if (distractors.size < MAX_DISTRACTORS) {
            const otherAnswers = uniqueAnswers.filter(a => a !== correctAnswer && !sameSheetAnswers.includes(a));
            arrayUtils.shuffleArray(otherAnswers); // Use shuffleArray from arrayUtils
            for (const answer of otherAnswers) {
                if (distractors.size >= MAX_DISTRACTORS) break;
                distractors.add(answer);
            }
        }

        // Fallback: If still not enough, create simple variations (less ideal)
        // This part is rudimentary and might need improvement
        let fallbackCounter = 1;
        while (distractors.size < MAX_DISTRACTORS) {
            const fallback = `${correctAnswer}_v${fallbackCounter++}`;
            if (!distractors.has(fallback)) {
                distractors.add(fallback);
            } else if (fallbackCounter > 100) {
                 break; // Prevent infinite loop
            }
        }

        return arrayUtils.shuffleArray(Array.from(distractors)); // Use shuffleArray from arrayUtils
    }
}

// Create a singleton instance
const quizEngine = new QuizEngine();
export default quizEngine; 