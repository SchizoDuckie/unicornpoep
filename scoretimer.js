/**
 * This class extends the Timer class to manage the score calculation based on the timer,
 * using high precision timing.
 */
class ScoreTimer extends Timer {

    /**
     * Creates a ScoreTimer instance based on difficulty.
     * @param {string|null} difficulty - The difficulty level ('easy', 'medium', 'hard') or null.
     */
    constructor(difficulty) {
        // *** REVERT: Call base Timer constructor ***
        super();

        // *** REVERT: Set durationMs using the original difficulty logic ***
        this.durationMs = this.getTimerDuration(difficulty);
        // Store duration in seconds based on the calculated ms
        this.duration = this.durationMs / 1000;

        // Reset internal state inherited from Timer
        this.startTime = null;
        this.isRunning = false;
        console.log(`ScoreTimer initialized: difficulty=${difficulty}, durationMs=${this.durationMs}`);
    }

    /**
     * Calculates the timer duration based on the difficulty level.
     * @param {string|null} difficulty The selected difficulty level.
     * @returns {number} Timer duration in milliseconds.
     */
    getTimerDuration(difficulty) {
        switch (difficulty) {
            case 'easy': return 60000; // 60 seconds
            case 'medium': return 30000; // 30 seconds
            case 'hard': return 10000; // 10 seconds
            default: return 0; // No timer for practice mode
        }
    }

    /**
     * Calculates the score based on elapsed time and difficulty.
     * Needs to be called *after* the timer has stopped.
     * @param {string} difficulty - Difficulty level ('easy', 'medium', 'hard').
     * @returns {number} Calculated score.
     */
    calculateScore(difficulty) { // Keep difficulty param if needed here
        // Use this.durationMs if the base timer accurately stops startTime
        if (!this.isRunning && this.startTime) {
            const elapsedMs = Date.now() - this.startTime;
            // Use seconds duration for calculation if easier
            const elapsedSec = elapsedMs / 1000;
            const baseScore = 10;
            const maxTimeBonus = 50;
            // Use this.duration (seconds) for calculation clarity
            const timeFactor = this.duration > 0 ? Math.max(0, 1 - (elapsedSec / this.duration)) : 0;
            const timeBonus = Math.round(maxTimeBonus * timeFactor);

            console.log(`Score calc: elapsedSec=${elapsedSec}, durationSec=${this.duration}, timeFactor=${timeFactor}, timeBonus=${timeBonus}`);
            return baseScore + timeBonus;
        }
        return 0;
    }
}
