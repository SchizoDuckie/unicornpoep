/**
 * A reusable timer class using high-precision timing if available.
 * Manages starting, stopping, and periodic tick callbacks.
 */
class Timer {
    /**
     * Creates a Timer instance.
     * Note: Duration is typically set by subclasses or specific game logic needs AFTER construction.
     * The constructor itself doesn't take duration.
     */
    constructor() {
        this.startTime = null;
        this.intervalId = null;
        this.isRunning = false;
        this.tickCallback = null;
        this.durationMs = 0; // Subclasses like ScoreTimer will set this
        console.log("Base Timer initialized."); // Log base class init
    }

    /**
     * Starts the timer.
     * @param {function(number): void} tickCallback - Function to call on each tick, receives remaining time in MS.
     * @param {number} [interval=100] - The interval duration in milliseconds for ticks.
     * @throws {Error} If durationMs is not set or tickCallback is not a function.
     */
    start(tickCallback, interval = 100) {
        if (this.isRunning) {
            console.warn("Timer: Start called while already running. Stopping first.");
            this.stop();
        }
        if (typeof tickCallback !== 'function') {
             throw new Error("Timer: tickCallback must be a function.");
        }
        // *** CRITICAL: durationMs must be set by the instance BEFORE calling start() ***
        if (this.durationMs <= 0) {
             console.error("Timer: Cannot start timer, durationMs is not set or is zero.");
             // Optional: throw an error? Or just return? Let's return to avoid crash.
             return;
        }

        this.startTime = Date.now();
        this.isRunning = true;
        this.tickCallback = tickCallback;
        console.log(`Timer: Starting with duration ${this.durationMs}ms, interval ${interval}ms`); // Log start details

        // Initial immediate tick
        this.tick();

        // Set up the interval
        this.intervalId = setInterval(() => this.tick(), interval);
    }

    /**
     * Stops the timer and clears the interval.
     */
    stop() {
        if (!this.isRunning) {
            // console.log("Timer: Stop called but timer was not running."); // Optional: reduce log noise
            return;
        }
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        this.startTime = null; // Reset startTime when stopped
        this.tickCallback = null;
        // console.log("Timer: Stopped."); // Optional: reduce log noise
    }

    /**
     * The internal tick function called by setInterval.
     * Calculates remaining time and calls the callback or stops on timeout.
     */
    tick() {
        if (!this.isRunning || !this.startTime) {
            console.warn("Timer: Tick called while not running or startTime is null.");
            this.stop(); // Ensure stopped state consistency
            return;
        }

        const elapsed = Date.now() - this.startTime;
        const remaining = Math.max(0, this.durationMs - elapsed);

        // console.log(`Timer Tick: Elapsed=${elapsed}ms, Remaining=${remaining}ms (Duration=${this.durationMs}ms)`); // DEBUG LOG

        // Call the provided callback with the remaining time
        if (this.tickCallback) {
             try {
                 this.tickCallback(remaining);
             } catch (error) {
                  console.error("Timer: Error in tickCallback:", error);
                  this.stop(); // Stop timer if callback errors out
             }
        } else {
             console.warn("Timer: Tick called but no tickCallback is set.");
             this.stop();
             return; // Stop if no callback
        }


        // Check if time has run out
        if (remaining <= 0) {
             console.log(`Timer: Time expired (Elapsed: ${elapsed}ms, Duration: ${this.durationMs}ms). Stopping.`);
            this.stop(); // Stop the timer automatically when time runs out
            // The last call to tickCallback already happened with remaining <= 0
        }
    }
}
