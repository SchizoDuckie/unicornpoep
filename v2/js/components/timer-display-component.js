import BaseComponent from './base-component.js';
import Events from '../core/event-constants.js';
import eventBus from '../core/event-bus.js';
import Timer from '../core/timer.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * @class TimerDisplayComponent
 * @extends BaseComponent
 * Manages the display of the game timer.
 * Listens for time ticks to update the remaining time and handles low/critical time states.
 */
class TimerDisplayComponent extends BaseComponent {
    /**
     * Creates an instance of TimerDisplayComponent.
     */
    constructor() {
        // *** FIX: Use the correct selector from v2/index.html ***
        super('#timerDisplay', 'TimerDisplay'); 

        if (!this.rootElement) {
             // Error should have been thrown by super() if element not found
             // This check is technically redundant due to BaseComponent's constructor validation
             // but kept for clarity during debugging potential BaseComponent changes.
             console.error(`[${this.name}] Component couldn't initialize because root element was not found.`);
             return;
        }
        
        // Constants for styling
        this.lowTimeThresholdSeconds = 10;
        this.criticalTimeThresholdSeconds = 5;
        this.lowTimeClass = 'time-low';
        this.criticalTimeClass = 'time-critical';
        this.timeUpClass = 'time-up';
        // Use template for default display
        this.defaultDisplay = getTextTemplate('timerDefault');

        this._bindMethods(); // Keep existing binding pattern

        // Listen to relevant game events
        this.listen(Events.Game.Started, this.handleGameStart);
        this.listen(Events.Game.TimeTick, this.updateDisplay);
        this.listen(Events.Game.Finished, this.handleGameEnd);
        // Reset display on finish, UIManager handles visibility

        // Initialize display state
        this.hide(); // Start hidden, show when game starts or timer ticks
    }

    /**
     * Binds component methods to the class instance.
     * Preserved from original structure.
     */
    _bindMethods() {
        this.updateDisplay = this.updateDisplay.bind(this);
        this.handleGameStart = this.handleGameStart.bind(this);
        this.handleGameEnd = this.handleGameEnd.bind(this);
        // No need to bind show/hide from BaseComponent
    }

    /**
     * Updates the timer display with the remaining time.
     * @param {object} payload - Event payload from Events.Game.TimeTick.
     * @param {number} payload.remainingTimeMs - Remaining time in milliseconds.
     */
    updateDisplay({ remainingTimeMs }) {
        if (this.rootElement && typeof remainingTimeMs === 'number') {
            const formattedTime = Timer.formatTime(remainingTimeMs);

            this.show(); // Ensure visible
            this.rootElement.textContent = formattedTime; 
            // Check if element is actually visible after update
            setTimeout(() => { // Use setTimeout to check after potential rendering updates
                 if (this.rootElement.offsetParent === null && this.isVisible) { // Only warn if component thinks it's visible
                      console.warn(`[${this.name}] Element might be hidden by CSS or other means after update attempt.`);
                 }
            }, 0);
        } else {
            console.warn(`[${this.name}] updateDisplay called with invalid data or missing rootElement. Data:`, { remainingTimeMs, rootExists: !!this.rootElement });
        }
    }

    /** Shows the timer when the game starts. */
    handleGameStart(payload) {
        this.show();
        if (payload && typeof payload.initialDurationMs === 'number') {
             this.rootElement.textContent = Timer.formatTime(payload.initialDurationMs);
        } else {
             this.rootElement.textContent = Timer.formatTime(0);
        }
    }
    
    /** Hides or resets the timer when the game ends. */
    handleGameEnd() {
        this.hide(); 
    }

    /**
     * Cleans up listeners on destruction.
     * Overrides BaseComponent.destroy if needed, but base handles listeners.
     */
    destroy() {
        // BaseComponent's destroy automatically handles listener cleanup via cleanupListeners()
        super.destroy();
    }
}

export default TimerDisplayComponent; 