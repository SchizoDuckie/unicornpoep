import BaseComponent from './base-component.js';
import Events from '../core/event-constants.js';
import eventBus from '../core/event-bus.js';
import Timer from '../core/timer.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * @class TimerDisplayComponent
 * @extends BaseComponent
 * Displays the countdown timer for questions.
 */
class TimerDisplayComponent extends BaseComponent {
    static SELECTOR = '#timerDisplay';
    static VIEW_NAME = 'TimerDisplayComponent';


    /** Initializes the component. */
    initialize() {
        console.log(`[${this.name}] Initializing...`);
        // The root element itself will display the time
        this.timerTextElement = this.rootElement; 
        
        // Check if root element was found by BaseComponent
        if (!this.timerTextElement) {
             throw new Error(`[${this.name}] Root element not found with selector: ${this.selector}`);
        }
        
        // Constants for styling
        this.lowTimeThresholdSeconds = 10;
        this.criticalTimeThresholdSeconds = 5;
        this.lowTimeClass = 'time-low';
        this.criticalTimeClass = 'time-critical';
        this.timeUpClass = 'time-up';
        this.defaultDisplay = getTextTemplate('timerDefault') || '--:--'; // Add fallback

        // --- Bind Handlers Here --- 
        this._updateDisplay = this._updateDisplay.bind(this);
        this._handleGameStart = this._handleGameStart.bind(this);
        this._handleGameEnd = this._handleGameEnd.bind(this);
        this.clearTimer = this.clearTimer.bind(this); // Bind clearTimer
        
        this.clearTimer(); // Set initial state
        console.log(`[${this.name}] Initialized.`);
    }

    /** Registers eventBus listeners using pre-bound handlers. */
    registerListeners() {
        console.log(`[${this.name}] Registering listeners.`);
        // Listen to relevant game events
        this.listen(Events.Game.Started, this._handleGameStart);
        this.listen(Events.Game.TimeTick, this._updateDisplay);
        this.listen(Events.Game.TimeUp, this._handleGameEnd); // Also stop/reset on TimeUp
        this.listen(Events.Game.Finished, this._handleGameEnd);
    }

    /** Updates the timer display with the remaining time. */
    _updateDisplay(payload) { // Receive raw payload first
        const remainingTimeMs = payload?.remainingTimeMs; // Extract manually for checking

        if (this.timerTextElement && typeof remainingTimeMs === 'number') {
            const formattedTime = Timer.formatTime(remainingTimeMs);
            this.show(); // Ensure visible
            this.timerTextElement.textContent = formattedTime; 

            // Apply styling based on thresholds
            const remainingSeconds = remainingTimeMs / 1000;
            this.timerTextElement.classList.remove(this.lowTimeClass, this.criticalTimeClass, this.timeUpClass);
            if (remainingSeconds <= this.criticalTimeThresholdSeconds) {
                 this.timerTextElement.classList.add(this.criticalTimeClass);
            } else if (remainingSeconds <= this.lowTimeThresholdSeconds) {
                 this.timerTextElement.classList.add(this.lowTimeClass);
            }
            
        } else {
            console.warn(`[${this.name}] updateDisplay called with invalid data or missing rootElement.`);
        }
    }

    /** Shows the timer when the game starts. */
    _handleGameStart(payload) {
        console.log(`[${this.name}] Game started, showing timer.`);
        this.show();
        const initialDuration = payload?.settings?.timerDuration || payload?.initialDurationMs; // Check potential payload structures
        if (typeof initialDuration === 'number') {
             this.timerTextElement.textContent = Timer.formatTime(initialDuration);
        } else {
             this.clearTimer(); // Use default if no duration found
        }
    }
    
    /** Hides and resets the timer when the game ends or time runs out. */
    _handleGameEnd() {
        console.log(`[${this.name}] Game ended or time up, hiding timer.`);
        this.hide(); 
        this.clearTimer();
    }

    /** Clears the timer display and resets styling. */
    clearTimer() {
        if (this.timerTextElement) {
             this.timerTextElement.textContent = this.defaultDisplay;
             this.timerTextElement.classList.remove(this.lowTimeClass, this.criticalTimeClass, this.timeUpClass);
        }
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