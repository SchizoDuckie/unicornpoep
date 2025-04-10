import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js'; // If you use this

// Import QuestionsManager to get sheet details
import questionsManager from '../services/QuestionsManager.js'; 

/**
 * Manages the display of the player's score, typically for single-player or practice modes.
 * Listens for score updates related to the local player.
 * @extends BaseComponent
 */
class ScoreDisplayComponent extends BaseComponent {
    /**
     * @param {string} elementSelector CSS selector for the score display element (e.g., '#score').
     */
    constructor(elementSelector = '#scoreDisplay') {
        super(elementSelector, 'ScoreDisplay');

        if (!this.rootElement) return; // Handled by super()

        this._bindMethods();
        // Listen for score updates specific to the local player (no playerId)
        this.listen(Events.Game.ScoreUpdated, this.handleScoreUpdate);
        // Listen for game start to reset score display OR HIDE for MP
        this.listen(Events.Game.Started, this.handleGameStart); 
        // Listen for game end to hide (relevant for SP/Practice)
        this.listen(Events.Game.Finished, this.handleGameEnd); 
        // Optional: Listen for first question to ensure visibility and reset
        // this.listen(Events.Game.QuestionNew, this.handleFirstQuestion);

        this.resetScore(true); // Initialize with score 0 and hide initially

        // ** FIX: Re-add the base text **
        this.baseScoreText = 'Score: '; 
    }

    /** Binds component methods to the class instance. */
    _bindMethods() {
        this.handleScoreUpdate = this.handleScoreUpdate.bind(this);
        this.handleGameStart = this.handleGameStart.bind(this);
        this.handleGameEnd = this.handleGameEnd.bind(this);
        this.resetScore = this.resetScore.bind(this);
        // this.handleFirstQuestion = this.handleFirstQuestion.bind(this);
    }

    /**
     * Handles the Game Started event.
     * Resets score and shows for SP/Practice, hides for MP.
     * @param {object} payload
     * @param {string} payload.mode - Game mode ('single', 'multiplayer', 'practice').
     * @private
     */
    handleGameStart(payload) {
        this.resetScore(true); 
        // Removed the sheet title logic from here as it doesn't belong in this component.
        // The check `if (this.sheetTitleElement)` was failing because this element
        // is not managed by ScoreDisplayComponent.
        console.log(`[${this.name}] Game Started (mode: ${payload.settings.gameMode}), score reset.`);

        // Example of how the title *could* be set (needs a dedicated component):
        // if (this.sheetTitleElement) { // Check if the element exists first
        //      let titleSet = false;
        //      if (payload.settings.sheetIds && questionsManager) { // Check QM exists
        //          const sheetIds = payload.settings.sheetIds;
        //          if (sheetIds.length > 0) {
        //              try {
        //                  const firstSheetId = sheetIds[0];
        //                  const sheetName = questionsManager.getSheetDisplayName(firstSheetId); 
        //                  if (sheetName) { 
        //                      this.sheetTitleElement.textContent = sheetName; 
        //                      titleSet = true;
        //                  } 
        //              } catch (e) {
        //                  console.error("Error setting sheet title:", e);
        //              }
        //          } 
        //      } 
        //      if (!titleSet) {
        //          this.sheetTitleElement.textContent = (payload.settings.gameMode === 'practice') ? 'Oefenronde' : 'Spel Gestart'; // Fallback
        //      }
        // } else {
        //      console.error("sheetTitleElement not found for title update!");
        // }
    }

    /**
     * Updates the score display if the update pertains to the local player.
     * @param {object} payload - The event payload.
     * @param {number} payload.totalScore - The new total score.
     * @param {string} [payload.playerId] - Optional player ID. If present, ignore (handled by PlayerList).
     */
    handleScoreUpdate({ totalScore, playerId }) {
        if (!this.rootElement) return;
        // Ignore score updates intended for specific players in multiplayer
        if (playerId) {
            console.debug(`[${this.name}] Ignoring score update for player ${playerId}.`);
            return;
        }
        console.debug(`[${this.name}] Updating score display to: ${totalScore}`);
        this.rootElement.textContent = `${this.baseScoreText}${totalScore}`;
        this.show(); 
    }

    /**
     * Resets the score display to 0.
     * Ensures the component is visible unless explicitly told to hide.
     * @param {boolean} [hideAfterReset=false] - Whether to hide the component after resetting.
     */
    resetScore(hideAfterReset = false) {
        if (this.rootElement) {
            console.debug(`[${this.name}] Resetting score display.`);
            this.rootElement.textContent = `${this.baseScoreText}0`;
            if (hideAfterReset) {
                this.hide();
            } else {
                this.show();
            }
        }
    }

    /** Hides the score display when the game ends. */
    handleGameEnd() {
        this.hide(); // Or maybe keep visible with final score? Depends on design.
    }

    // /**
    //  * Handles the first question event to ensure the score is visible and reset.
    //  * (Alternative/additional reset point)
    //  * @param {object} payload - The event payload.
    //  * @param {number} payload.questionIndex - The index of the question.
    //  */
    // handleFirstQuestion({ questionIndex }) {
    //     if (questionIndex === 0) {
    //         this.resetScore();
    //     }
    // }

    // No specific DOM listeners to add/remove in this component beyond BaseComponent
}

export default ScoreDisplayComponent;

