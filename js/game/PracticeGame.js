import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import QuizEngine from '../services/QuizEngine.js';
import BaseGameMode from './BaseGameMode.js';

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
        // Pass the QuizEngine instance AND correct mode to BaseGameMode constructor
        super('practice', settings, quizEngineInstance, playerName);
        console.log(`[PracticeGame] Initialized.`);
    }

    /**
     * Override the timer hooks. we don't need them for practice mode.
     */
    _beforeNextQuestion() { }
    _afterQuestionPresented() { }
    _beforeAnswerCheck() { }
    _beforeFinish() { }



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

    /**
     * Finishes the practice game and triggers the appropriate end dialog.
     * @override
     */
    finishGame() {
        if (this.isFinished) return;
        console.log(`[PracticeGame] Finishing game...`);
        
        // Get base results (even if score is 0)
        const results = this._getFinalResults({}); 
        
        // Emit the navigation event specific to Practice mode end FIRST
        console.log(`[PracticeGame] Requesting UIManager show Practice End Dialog.`);
        eventBus.emit(Events.Navigation.ShowView, {
            viewName: Views.PracticeEndDialog,
            data: results // Pass results (might be empty, but consistent)
        });
        
        // Call the base class finishGame AFTER showing dialog
        // to handle basic cleanup and emit Game.Finished
        super.finishGame(); 
    }
}

export default PracticeGame;
