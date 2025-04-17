import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import QuizEngine from '../services/QuizEngine.js';
import BaseGameMode from './BaseGameMode.js';

/**
 * Class PracticeGame.
 * 
 * Manages the state and logic for a practice game session. Extends BaseGameMode, 
 * providing the specific behavior for practice mode where players can practice
 * questions without time pressure or scoring.
 * 
 * Practice mode focuses exclusively on learning, allowing users to see correct answers
 * without the pressure of points or time limits. The game emits navigation events
 * to display appropriate UI dialogs when finished.
 * 
 * @property {string} mode Always 'practice'
 * @property {Object} settings Game configuration settings
 * @property {QuizEngine} quizEngine Instance handling questions and answers
 * @property {string} playerName Name of the player
 */
class PracticeGame extends BaseGameMode {
    /**
     * Creates a practice game instance.
     * 
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
     * Override the timer hooks. We don't need them for practice mode.
     */
    _beforeNextQuestion() { }
    
    /**
     * Override the timer hooks. We don't need them for practice mode.
     */
    _afterQuestionPresented() { }
    
    /**
     * Override the timer hooks. We don't need them for practice mode.
     */
    _beforeAnswerCheck() { }
    
    /**
     * Override the timer hooks. We don't need them for practice mode.
     */
    _beforeFinish() { }

    /**
     * Practice mode does not award points.
     * This overrides the base implementation in BaseGameMode.
     * 
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
     * Emits navigation event to show the practice end dialog before
     * calling the base class finishGame method for cleanup.
     * 
     * @override
     * @event Events.Navigation.ShowView
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
