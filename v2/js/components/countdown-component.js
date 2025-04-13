import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * @class CountdownComponent
 * @extends BaseComponent
 * Displays the 3..2..1 countdown before a game starts.
 */
class CountdownComponent extends BaseComponent {
    static SELECTOR = '#countdown';
    static VIEW_NAME = 'Countdown';

    /** Initializes component elements. */
    initialize() {
        this.countdownText = this.rootElement.querySelector('#countdownText');
        if (!this.countdownText) {
            console.error(`[${this.name}] Missing required child element #countdownText.`);
        }
        this.intervalId = null;
        this.currentCount = 0;
        this.completionCallback = null;
        this.hide(); // Start hidden
        console.log(`[${this.name}] Initialized.`);

        // Listen for an event to trigger the countdown
        this.listen(Events.Game.CountdownStart, this.handleCountdownStart); 
        // Listen for game end events to stop countdown if it's running
        this.listen(Events.Game.Finished, this.stopCountdown);
        // Assuming an Aborted or Leave event exists that GameCoordinator/BaseGameMode might emit
        this.listen(Events.Game.Aborted, this.stopCountdown); // Add listener for abort
    }

    /** Registers DOM listeners (none needed). */
    registerListeners() {
        console.log(`[${this.name}] Registering DOM listeners (none).`);
    }
    /** Unregisters DOM listeners (none needed). */
    unregisterListeners() {
        console.log(`[${this.name}] Unregistering DOM listeners (none).`);
    }

    /**
     * Handles the event requesting a countdown.
     * @param {object} [payload]
     * @param {number} [payload.duration=3]
     * @private
     */
    handleCountdownStart(payload = {}) {
        console.log(`[${this.name}] handleCountdownStart called with payload:`, payload);
        const duration = payload.duration && typeof payload.duration === 'number' ? payload.duration : 3;
        // Define end message and completion event if needed, or pass from payload
        const endMessage = payload.endMessage || getTextTemplate('countdownGo');
        const completionEvent = payload.completionEvent || null;
        this.startCountdown(duration, endMessage, completionEvent);
    }

    /**
     * Starts the countdown sequence.
     * @param {number} [duration=3] - Countdown duration in seconds.
     * @param {string} [endMessage] - Message to display after countdown (defaults to template value).
     * @param {string} [completionEvent] - Optional event to emit when countdown finishes.
     */
    startCountdown(duration = 3, endMessage, completionEvent = null) {
        // Fetch default end message from template if not provided
        const finalEndMessage = endMessage !== undefined ? endMessage : getTextTemplate('countdownGo');

        if (this.intervalId) clearInterval(this.intervalId); // Clear existing interval

        console.log(`[${this.name}] Starting countdown from ${duration}...`);
        let remaining = duration;

        // Use the inner span to display the text
        if (this.countdownText) { 
            this.countdownText.textContent = remaining;
        } else {
             console.error(`[${this.name}] countdownText element not found in startCountdown!`);
        }
        this.show(); // Make countdown visible

        this.intervalId = setInterval(() => {
            remaining--;
            if (remaining > 0) {
                // Use the inner span
                if (this.countdownText) this.countdownText.textContent = remaining;
            } else {
                clearInterval(this.intervalId);
                this.intervalId = null;
                // Use the inner span
                if (this.countdownText) this.countdownText.textContent = finalEndMessage; 
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