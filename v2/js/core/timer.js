import Events from './event-constants.js';
import eventBus from './event-bus.js';

/**
 * A reusable timer class that emits events for ticks and completion.
 * Uses setInterval for timing.
 */
class Timer {
    /**
     * Creates a Timer instance.
     * @param {number} [durationSeconds=30] - The duration of the timer in seconds.
     */
    constructor(durationSeconds = 30) {
        this.durationMs = durationSeconds * 1000;
        this.remainingMs = this.durationMs;
        this.startTime = null;
        this.intervalId = null;
        this.isRunning = false;
        this.listeners = {}; // For event emitter pattern
        this.lastElapsedMs = 0; // Added to store elapsed time on stop
        this._initialStartTime = null; // Store the timestamp when start() was originally called
        console.log(`[Timer] Initialized with duration: ${durationSeconds}s`);
    }

    /**
     * Registers a listener for a specific event ('tick' or 'end').
     * @param {string} eventName - 'tick' or 'end'.
     * @param {Function} callback - The function to execute.
     */
    on(eventName, callback) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        if (!this.listeners[eventName].includes(callback)) {
            this.listeners[eventName].push(callback);
        } else {
            console.warn(`[Timer] Listener already registered for '${eventName}'`);
        }
    }

    /**
     * Removes a listener for a specific event.
     * @param {string} eventName - 'tick' or 'end'.
     * @param {Function} callback - The specific listener function to remove.
     */
    off(eventName, callback) {
        if (this.listeners[eventName]) {
            const index = this.listeners[eventName].indexOf(callback);
            if (index > -1) {
                this.listeners[eventName].splice(index, 1);
                if (this.listeners[eventName].length === 0) {
                    delete this.listeners[eventName];
                }
            }
        }
    }

    /**
     * Emits an event to all registered listeners.
     * @param {string} eventName - 'tick' or 'end'.
     * @param {...any} args - Arguments to pass to the listeners.
     * @private
     */
    emit(eventName, ...args) {
        const eventListeners = this.listeners[eventName];
        if (eventListeners) {
            [...eventListeners].forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[Timer] Error in listener for '${eventName}':`, error, "Args:", args);
                    // Optionally stop timer on listener error?
                    // this.stop();
                }
            });
        }
    }

    /**
     * Starts the timer.
     * Emits 'tick' events at regular intervals and 'end' when finished.
     * @param {number} [interval=100] - The interval duration in milliseconds for ticks.
     */
    start(interval = 100) {
        if (this.isRunning) {
            console.warn("[Timer] Start called while already running. Ignoring.");
            return;
        }
        if (this.durationMs <= 0) {
             console.error("[Timer] Cannot start timer, duration is zero or negative.");
             return;
        }
        
        // Use remaining time if timer was stopped and restarted
        // But typically, reset() should be called before start if resuming from 0.
        if (this.remainingMs <= 0) {
             this.reset(); // Reset if starting from 0
        }
        
        this._initialStartTime = Date.now(); // Record the absolute start time
        this.startTime = this._initialStartTime; // Keep startTime for elapsed calculation if needed between stop/start, though reset usually precedes start
        this.isRunning = true;
        console.log(`[Timer] Starting. Duration: ${this.durationMs}ms, Remaining: ${this.remainingMs}ms, Interval: ${interval}ms`);

        // Initial immediate tick calculation based on current remainingMs
        this.emit('tick', this.remainingMs); 

        // Set up the interval
        this.intervalId = setInterval(() => this._tick(), interval);
    }

    /**
     * Stops the timer and clears the interval.
     * Does NOT emit 'end' event; that only happens on natural completion.
     */
    stop() {
        if (!this.isRunning) return;
        console.log('[Timer] Stopping...');
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        // Capture elapsed time *before* clearing startTime
        if (this.startTime) {
             this.lastElapsedMs = Date.now() - this._initialStartTime;
             console.debug(`[Timer] Captured lastElapsedMs = ${this.lastElapsedMs}ms`);
        } else {
            this.lastElapsedMs = 0; // Reset if stopped prematurely
        }
        this.isRunning = false;
        this.startTime = null; // Clear start time AFTER capturing elapsed
        // DO NOT clear _initialStartTime here, reset() handles that
    }
    
    /**
     * Resets the timer to its initial duration and stopped state.
     */
    reset() {
        this.stop();
        this.remainingMs = this.durationMs;
        this.lastElapsedMs = 0; // Also reset captured time
        this._initialStartTime = null; // Reset the initial start time
        console.log(`[Timer] Reset to ${this.durationMs}ms`);
    }

    /**
     * The internal tick function called by setInterval.
     * Calculates remaining time, emits 'tick' or 'end', and stops if finished.
     * @private
     */
    _tick() {
        if (!this.isRunning || !this._initialStartTime) {
            console.warn("[Timer] Tick called while not running or _initialStartTime is null.");
            if (this.intervalId) clearInterval(this.intervalId); // Failsafe
            this.intervalId = null;
            this.isRunning = false;
            return;
        }

        // Calculate elapsed time since the timer was originally started
        const elapsedTotal = Date.now() - this._initialStartTime;
        // Calculate remaining time based on the total duration and total elapsed time
        const currentRemaining = Math.max(0, this.durationMs - elapsedTotal);
        
        // Update remainingMs state (important if timer is stopped/queried)
        this.remainingMs = currentRemaining; 

        // Emit tick event with the correctly calculated remaining time
        this.emit('tick', currentRemaining);

        // Check if time has run out
        if (currentRemaining <= 0) {
            console.log(`[Timer] Time expired. Stopping and emitting 'end'.`);
            this.stop(); // Stop the timer
            this.emit('end'); // Emit the end event
        }
    }

     /**
      * Gets the current remaining time in milliseconds.
      * @returns {number} Remaining time in milliseconds.
      */
     getRemainingTime() {
         if (this.isRunning && this._initialStartTime) {
             // Calculate based on initial start time for accuracy
             const elapsed = Date.now() - this._initialStartTime;
             return Math.max(0, this.durationMs - elapsed);
         }
         return this.remainingMs; // Return stored remaining time if stopped
     }

    /**
     * Gets the time elapsed since the timer started (or the captured time if stopped).
     * @returns {number} Elapsed time in milliseconds.
     */
    getElapsedTime() {
        if (this.isRunning && this._initialStartTime) {
            // Calculate elapsed based on the initial start time
            return Date.now() - this._initialStartTime;
        } else {
            // Return the time captured when stopped, or 0 if never run/reset
            return this.lastElapsedMs;
        }
    }

    /**
     * Formats milliseconds into a display string (e.g., "15s").
     * @param {number} milliseconds - The time in milliseconds.
     * @returns {string} The formatted time string.
     */
    static formatTime(milliseconds) {
        if (typeof milliseconds !== 'number' || milliseconds < 0) {
            return '0s'; // Return 0s for invalid input
        }
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        // Just display the seconds with an 's' suffix
        return `${totalSeconds}s`;
    }
}

export default Timer; 