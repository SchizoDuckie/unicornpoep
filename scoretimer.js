/**
 * This class extends the Timer class to manage the score calculation based on the timer,
 * using high precision timing.
 */
class ScoreTimer extends Timer {

    constructor(difficulty) {
        super();
        this.setDuration(this.getTimerDuration(difficulty));
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
            case 'hard': return 5000; // 5 seconds
            default: return 0; // No timer for practice mode
        }
    }


    /**
     * Calculates the score based on the time remaining, in milliseconds.
     * 
     * @returns {number} The calculated score.
     */
    calculateScore(difficulty) {
        let multiplier = 0;
        switch(difficulty) {
            case 'easy':
                multiplier = 10;
                break;
            case 'medium':
                multiplier = 20;
                break;
            case 'hard':
                multiplier = 100;
                break;
        }
        const remaining = this.duration - (Date.now() - this.startTime);
        const score = Math.round((remaining / this.duration) * multiplier);
        return score > 0 ? score : 0; // Ensures the score is not negative
    }
}
