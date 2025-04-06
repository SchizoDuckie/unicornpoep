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
        this.lastElapsedMs = 0; // Initialize storage for elapsed time

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
     * Stops the timer, capturing the elapsed time just before stopping.
     * @override
     */
    stop() {
        if (this.isRunning && this.startTime) {
             this.lastElapsedMs = Date.now() - this.startTime;
             console.log(`ScoreTimer: Captured lastElapsedMs = ${this.lastElapsedMs} before stopping.`);
        } else {
            this.lastElapsedMs = 0; // Reset if stopped prematurely or wasn't running
        }
        super.stop(); // Call the base class stop method (clears interval, sets isRunning=false, startTime=null)
        // console.log("ScoreTimer: Stopped (called super.stop())."); // Optional logging
    }

    /**
     * Calculates the score based on the elapsed time captured by the stop() method.
     * Needs to be called *immediately after* the timer has stopped.
     * @returns {number} Calculated score.
     */
    calculateScore() {
        // Check if stop() was called and captured a valid elapsed time
        if (this.lastElapsedMs > 0 && this.durationMs > 0) {
             const elapsedMs = this.lastElapsedMs;
             const elapsedSec = elapsedMs / 1000;
             const baseScore = 10;
             const maxTimeBonus = 50;
             // Use this.duration (seconds) for calculation clarity
             const timeFactor = Math.max(0, 1 - (elapsedSec / this.duration));
             const timeBonus = Math.round(maxTimeBonus * timeFactor);

             console.log(`Score calc: Using lastElapsedMs=${elapsedMs} -> elapsedSec=${elapsedSec}, durationSec=${this.duration}, timeFactor=${timeFactor}, timeBonus=${timeBonus}`);
             // Reset lastElapsedMs after use? Maybe not necessary.
             return baseScore + timeBonus;
        } else {
            console.warn(`Score calc: Condition failed. lastElapsedMs=${this.lastElapsedMs}, durationMs=${this.durationMs}. Returning 0.`);
            return 0;
        }
    }
}
