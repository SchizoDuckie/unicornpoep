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
     * @param {string[]} settings.sheetIds - Array of sheet IDs to use.
     * @param {string} settings.difficulty - Difficulty level ('easy', 'medium', 'hard').
     */
    constructor(settings) {
        super('practice', settings);
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
