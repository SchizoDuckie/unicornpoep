import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

import QuizEngine from '../services/QuizEngine.js'; // Import QuizEngine
import BaseGameMode from './BaseGameMode.js';
// import Timer from '../utils/timer.js'; // Optional: Timer might not be needed for practice

/**
 * Manages the state and logic for a practice game session.
 * Extends BaseGameMode, providing the specific behavior for practice mode
 * (e.g., no scoring).
 */
class PracticeGame extends BaseGameMode {
    /**
     * Creates a practice game instance.
     * @param {object} settings - Game settings.
     * @param {QuizEngine} quizEngineInstance - The QuizEngine instance to use.
     * @param {string} playerName - The name of the player
     */
     constructor(settings, quizEngineInstance, playerName) {
        // Pass the QuizEngine instance to BaseGameMode constructor
        super('single', settings, quizEngineInstance, playerName);
        console.log(`[PracticeGame] Initialized.`);
    }

    /**
     * Practice mode does not award points.
     * This overrides the base implementation in BaseGameMode.
     * @override
     * @param {boolean} isCorrect - Whether the answer was correct.
     * @returns {number} Always returns 0.
     * @protected
     */
    _calculateScore(isCorrect) {
        return 0; // No score in practice mode
    }

    // Hooks from BaseGameMode can be overridden here if needed.
}

export default PracticeGame;
