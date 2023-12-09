/**
 * This class manages a high-precision countdown timer using requestAnimationFrame.
 */
class Timer {
    /**
     * Constructs the Timer instance.
     * 
     * @param {number} duration The duration of the timer in milliseconds.
     */
    constructor() {
        this.duration = 0;
        this.startTime = null;
        this.animationFrameId = null;
    }

    setDuration(duration) {
        this.duration = duration;
        return this;
    }

    /**
     * Starts the high-precision countdown timer.
     * 
     * @param {Function} onTick Callback function to execute on each tick, with the remaining time.
     */
    start(onTick) {
        this.startTime = Date.now();
        const tick = () => {
            const elapsed = Date.now() - this.startTime;
            const remaining = this.duration - elapsed;
            if (remaining <= 0) {
                onTick(0);
                this.stop();
            } else {
                onTick(remaining);
                this.animationFrameId = requestAnimationFrame(tick);
            }
        };
        this.animationFrameId = requestAnimationFrame(tick);
        return this;
    }

    /**
     * Stops the countdown timer.
     */
    stop() {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
        return this;
    }
}
