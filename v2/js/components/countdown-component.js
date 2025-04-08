import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

/**
 * @class CountdownComponent
 * @extends BaseComponent
 * Manages a visual countdown (e.g., "3, 2, 1, Go!") before a game or round starts.
 */
class CountdownComponent extends BaseComponent {
    /**
     * Creates an instance of CountdownComponent.
     */
    constructor() {
        super('#countdownDisplay', Views.Countdown);

        this.intervalId = null;

        this.hide(); // Start hidden
        console.log(`[${this.name}] Initialized`);

        // Listen for an event to trigger the countdown
        this.listen(Events.Game.CountdownStart, this.handleCountdownStart); 
        // Listen for game end events to stop countdown if it's running
        this.listen(Events.Game.Finished, this.stopCountdown);
        // Assuming an Aborted or Leave event exists that GameCoordinator/BaseGameMode might emit
        this.listen(Events.Game.Aborted, this.stopCountdown); // Add listener for abort
    }

    /**
     * Handles the event requesting a countdown.
     * @param {object} [payload]
     * @param {number} [payload.duration=3]
     * @private
     */
    handleCountdownStart(payload = {}) {
        const duration = payload.duration && typeof payload.duration === 'number' ? payload.duration : 3;
        // Define end message and completion event if needed, or pass from payload
        const endMessage = payload.endMessage || 'Go!';
        const completionEvent = payload.completionEvent || null;
        this.startCountdown(duration, endMessage, completionEvent);
    }

    /**
     * Starts the countdown sequence.
     * @param {number} [duration=3] - Countdown duration in seconds.
     * @param {string} [endMessage='Go!'] - Message to display after countdown.
     * @param {string} [completionEvent] - Optional event to emit when countdown finishes.
     */
    startCountdown(duration = 3, endMessage = 'Go!', completionEvent = null) {
        if (this.intervalId) clearInterval(this.intervalId); // Clear existing interval

        console.log(`[${this.name}] Starting countdown from ${duration}...`);
        let remaining = duration;

        this.rootElement.textContent = remaining;
        this.show(); // Make countdown visible

        this.intervalId = setInterval(() => {
            remaining--;
            if (remaining > 0) {
                this.rootElement.textContent = remaining;
            } else {
                clearInterval(this.intervalId);
                this.intervalId = null;
                this.rootElement.textContent = endMessage;
                console.log(`[${this.name}] Countdown finished.`);

                // Hide after a brief moment
                setTimeout(() => this.hide(), 1000);

                // Emit completion event if specified
                if (completionEvent) {
                    eventBus.emit(completionEvent);
                }
            }
        }, 1000); // Update every second
    }

    /** Stops any active countdown. */
    stopCountdown() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log(`[${this.name}] Countdown stopped.`);
            this.hide();
        }
    }

    // Override destroy to clear interval
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        this.stopCountdown();
        super.destroy();
    }
}

export default CountdownComponent; 