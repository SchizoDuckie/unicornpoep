import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import Events from '../core/event-constants.js';
import eventBus from '../core/event-bus.js';
import Timer from '../core/timer.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * @class TimerDisplayComponent
 * @extends RefactoredBaseComponent
 * Displays the countdown timer for questions.
 */
class TimerDisplayComponent extends RefactoredBaseComponent {
    static SELECTOR = '#timerDisplay';
    static VIEW_NAME = 'TimerDisplayComponent';
    
    // Constants for styling
    lowTimeThresholdSeconds = 10;
    criticalTimeThresholdSeconds = 5;
    lowTimeClass = 'time-low';
    criticalTimeClass = 'time-critical';
    timeUpClass = 'time-up';
    defaultDisplay = getTextTemplate('timerDefault') || '--:--';

    /** 
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration object with events and domEvents
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Game.Started,
                    callback: this._handleGameStart
                },
                {
                    eventName: Events.Game.TimeTick,
                    callback: this._updateDisplay
                },
                {
                    eventName: Events.Game.TimeUp,
                    callback: this._handleGameEnd
                },
                {
                    eventName: Events.Game.Finished,
                    callback: this._handleGameEnd
                }
            ],
            
            domEvents: [] // No DOM events to handle
        };
    }

    /** 
     * Updates the timer display with the remaining time.
     * @param {Object} payload - The event payload
     * @param {number} payload.remainingTimeMs - The remaining time in milliseconds
     */
    _updateDisplay(payload) {
        const remainingTimeMs = payload.remainingTimeMs;

        if (typeof remainingTimeMs === 'number') {
            const formattedTime = Timer.formatTime(remainingTimeMs);
            this.show();
            this.rootElement.textContent = formattedTime; 

            // Apply styling based on thresholds
            const remainingSeconds = remainingTimeMs / 1000;
            this.rootElement.classList.remove(this.lowTimeClass, this.criticalTimeClass, this.timeUpClass);
            if (remainingSeconds <= this.criticalTimeThresholdSeconds) {
                 this.rootElement.classList.add(this.criticalTimeClass);
            } else if (remainingSeconds <= this.lowTimeThresholdSeconds) {
                 this.rootElement.classList.add(this.lowTimeClass);
            }
        }
    }

    /** 
     * Shows the timer when the game starts.
     * @param {Object} payload - The event payload
     * @param {Object} payload.settings - The game settings
     * @param {number} [payload.settings.timerDuration] - The timer duration in milliseconds
     * @param {number} [payload.initialDurationMs] - Alternative timer duration
     */
    _handleGameStart(payload) {
        this.show();
        const initialDuration = payload.settings.timerDuration || payload.initialDurationMs;
        if (typeof initialDuration === 'number') {
             this.rootElement.textContent = Timer.formatTime(initialDuration);
        } else {
             this.clearTimer();
        }
    }
    
    /** 
     * Hides and resets the timer when the game ends or time runs out.
     */
    _handleGameEnd() {
        this.hide();
        this.clearTimer();
    }

    /** 
     * Clears the timer display and resets styling.
     */
    clearTimer() {
        this.rootElement.textContent = this.defaultDisplay;
        this.rootElement.classList.remove(this.lowTimeClass, this.criticalTimeClass, this.timeUpClass);
    }
}

export default TimerDisplayComponent; 