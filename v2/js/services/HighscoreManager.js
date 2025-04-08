import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


const HIGHSCORE_STORAGE_KEY = 'unicornpoep_highscores_v2';
const MAX_HIGHSCORES = 10;

/**
 * Manages loading, saving, and retrieving high scores.
 * Uses localStorage for persistence.
 */
class HighscoreManager {
    constructor() {
        console.info("[HighscoreManager] Initializing...");
        this.highscores = this.loadHighscores();

        // Listen for game finished events to potentially add new scores
        eventBus.on(Events.Game.Finished, this.handleGameFinished.bind(this));
        // Listen for requests to show highscores
        eventBus.on(Events.Menu.Highscores.ShowRequested, this.handleShowRequest.bind(this));
    }

    /**
     * Loads high scores from local storage.
     * @returns {Array<object>} The loaded high scores, sorted descending by score.
     * @private
     */
    loadHighscores() {
        try {
            const storedScores = localStorage.getItem(HIGHSCORE_STORAGE_KEY);
            if (storedScores) {
                const scores = JSON.parse(storedScores);
                // Basic validation
                if (Array.isArray(scores) && scores.every(s => typeof s === 'object' && 'name' in s && 'score' in s)) {
                     console.log(`[HighscoreManager] Loaded ${scores.length} scores from localStorage.`);
                     // Ensure scores are sorted
                     return scores.sort((a, b) => b.score - a.score);
                } else {
                    console.warn("[HighscoreManager] Invalid data found in localStorage. Resetting high scores.");
                    localStorage.removeItem(HIGHSCORE_STORAGE_KEY);
                }
            }
        } catch (error) {
            console.error("[HighscoreManager] Error loading high scores from localStorage:", error);
        }
        console.log("[HighscoreManager] No valid scores found in localStorage. Starting with empty list.");
        return [];
    }

    /**
     * Saves the current high scores list to local storage.
     * @private
     */
    saveHighscores() {
        try {
            localStorage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(this.highscores));
            console.log(`[HighscoreManager] Saved ${this.highscores.length} scores to localStorage.`);
        } catch (error) {
            console.error("[HighscoreManager] Error saving high scores to localStorage:", error);
            eventBus.emit(Events.System.ShowFeedback, { message: 'Could not save high score.', level: 'error' });
        }
    }

    /**
     * Adds a new score to the high scores list if it qualifies.
     * Keeps the list sorted and capped at MAX_HIGHSCORES.
     * @param {string} name - Player name.
     * @param {number} score - Achieved score.
     * @returns {boolean} True if the score was added, false otherwise.
     */
    addHighscore(name, score) {
        if (typeof name !== 'string' || typeof score !== 'number' || score <= 0) {
            console.warn(`[HighscoreManager] Invalid score attempt: Name='${name}', Score=${score}`);
            return false;
        }

        const newScoreEntry = { name, score, date: new Date().toISOString() };

        // Check if the score is high enough
        if (this.highscores.length < MAX_HIGHSCORES || score > this.highscores[this.highscores.length - 1].score) {
            this.highscores.push(newScoreEntry);
            this.highscores.sort((a, b) => b.score - a.score); // Sort descending by score

            // Keep only the top N scores
            if (this.highscores.length > MAX_HIGHSCORES) {
                this.highscores.length = MAX_HIGHSCORES;
            }

            console.log(`[HighscoreManager] Added new high score: ${name} - ${score}. List size: ${this.highscores.length}`);
            this.saveHighscores();
            return true;
        } else {
            console.log(`[HighscoreManager] Score ${score} by ${name} not high enough to make the list.`);
            return false;
        }
    }

    /**
     * Returns the current list of high scores.
     * @returns {Array<object>} A copy of the high scores list.
     */
    getHighscores() {
        return [...this.highscores]; // Return a copy to prevent external modification
    }

    /**
     * Handles the Game.Finished event to potentially add a new high score.
     * Only considers single-player game results for now.
     * @param {object} payload - Event payload.
     * @param {'single' | 'multiplayer' | 'practice'} payload.mode - Game mode.
     * @param {object} payload.results - Game results.
     * @private
     */
    handleGameFinished({ mode, results }) {
        // Only record high scores for single player mode for now
        if (mode === 'single' && results && typeof results.score === 'number') {
            // Assume results contains playerName, adjust if needed based on actual payload
            const playerName = results.playerName || 'Player'; // Use a default if name isn't passed
            this.addHighscore(playerName, results.score);
        } else if (mode === 'practice') {
            console.log("[HighscoreManager] Practice mode finished, no high score recorded.");
        } else if (mode === 'multiplayer') {
            console.log("[HighscoreManager] Multiplayer mode finished, individual high score recording TBD.");
             // TODO: Decide how/if to record MP high scores (e.g., highest score in the match?)
        }
    }

    /**
     * Handles the request to show the high scores view.
     * Emits the Loaded event with the current scores.
     * @private
     */
     handleShowRequest() {
        console.log("[HighscoreManager] Received ShowRequested event for Highscores.");
        try {
             // Ensure scores are loaded (they should be by constructor, but check again)
             if (!this.highscores) {
                 this.highscores = this.loadHighscores();
             }
            eventBus.emit(Events.Menu.Highscores.Loaded, { scores: this.getHighscores() });
            // The UIManager or HighscoresComponent will handle navigation
        } catch (error) {
            console.error("[HighscoreManager] Error handling highscore show request:", error);
            eventBus.emit(Events.Menu.Highscores.LoadFailed, { message: "Could not load high scores." });
             eventBus.emit(Events.System.ShowFeedback, { message: 'Error loading high scores.', level: 'error' });
        }
    }
}

// Create and export a singleton instance
const highscoreManager = new HighscoreManager();
export default highscoreManager;
