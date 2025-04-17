import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * @class CountdownComponent
 * @extends RefactoredBaseComponent
 * Displays the 5..4..3..2..1 countdown before a game starts.
 */
class CountdownComponent extends RefactoredBaseComponent {
    static SELECTOR = '#countdown';
    static VIEW_NAME = 'Countdown';
    
    static SELECTORS = {
        TEXT: '#countdownText'
    };
    
    // State properties
    intervalId = null;
    currentCount = 0;
    completionCallback = null;

    /** 
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration object with events, domEvents, and domElements
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Game.CountdownStart,
                    callback: this.handleCountdownStart
                },
                {
                    eventName: Events.Game.Finished,
                    callback: this.stopCountdown
                },
                {
                    eventName: Events.Game.Aborted,
                    callback: this.stopCountdown
                }
            ],
            
            domEvents: [], // No DOM events to handle
            
            domElements: [
                {
                    name: 'countdownText',
                    selector: CountdownComponent.SELECTORS.TEXT
                }
            ]
        };
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
        const endMessage = payload.endMessage || getTextTemplate('countdownGo');
        const completionEvent = payload.completionEvent || null;
        this.startCountdown(duration, endMessage, completionEvent);
    }

    /**
     * Starts the countdown sequence.
     * @param {number} [duration=5] - Countdown duration in seconds.
     * @param {string} [endMessage] - Message to display after countdown (defaults to template value).
     * @param {string} [completionEvent] - Optional event to emit when countdown finishes.
     * @event Dynamic - Emits the event specified in completionEvent parameter when countdown completes
     */
    startCountdown(duration = 5, endMessage, completionEvent = null) {
        // Fetch default end message from template if not provided
        const finalEndMessage = endMessage !== undefined ? endMessage : getTextTemplate('countdownGo');

        if (this.intervalId) clearInterval(this.intervalId); // Clear existing interval

        let remaining = duration;

        // Update the text display
        this.elements.countdownText.textContent = remaining;
        
        // Make sure the countdown is visible and prominent
        this.rootElement.classList.remove('hidden');
      
        console.log(`[${this.constructor.name}] Countdown started with duration: ${duration}s`);
        
        this.show(); // Make countdown visible

        this.intervalId = setInterval(() => {
            remaining--;
            if (remaining > 0) {
                this.elements.countdownText.textContent = remaining;
                console.log(`[${this.constructor.name}] Countdown: ${remaining}s remaining`);
            } else {
                clearInterval(this.intervalId);
                this.intervalId = null;
                this.elements.countdownText.textContent = finalEndMessage; 
                console.log(`[${this.constructor.name}] Countdown finished: "${finalEndMessage}"`);

                // Hide after a brief moment
                setTimeout(() => {
                    this.hide();
                    this.rootElement.style.zIndex = ''; // Reset z-index
                    console.log(`[${this.constructor.name}] Countdown hidden`);
                }, 1000);

                // Emit completion event if specified
                if (completionEvent) {
                    eventBus.emit(completionEvent);
                }
            }
        }, 1000); // Update every second
    }

    /** 
     * Stops any active countdown. 
     */
    stopCountdown() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.hide();
        }
    }

    /**
     * Override destroy to clear interval
     * @override
     */
    destroy() {
        this.stopCountdown();
        super.destroy();
    }

    /**
     * Override show to make sure the component is visible and positioned properly.
     * @override
     */
    show() {
        super.show();
        
        // Make sure the countdown is clearly visible
        if (this.rootElement) {
            this.rootElement.style.display = 'flex';
            this.rootElement.style.justifyContent = 'center';
            this.rootElement.style.alignItems = 'center';
            this.rootElement.style.position = 'fixed';
            this.rootElement.style.zIndex = '9999';
            console.log(`[${this.constructor.name}] Ensuring countdown is visible and prominent`);
        }
    }
}

export default CountdownComponent; 