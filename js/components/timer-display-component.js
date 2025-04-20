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
    static IS_GAME_AREA_CHILD = true;
    
    // Constants for styling
    lowTimeThresholdSeconds = 10;
    criticalTimeThresholdSeconds = 5;
    lowTimeClass = 'time-low';
    criticalTimeClass = 'time-critical';
    timeUpClass = 'time-up';
    defaultDisplay = getTextTemplate('timerDefault') || '--:--';

    // State for RAF loop
    activeTimer = null;
    rafId = null;
    _isLoopRunning = false; // Explicit flag for loop state
    _lastDisplayedTime = null; // *** ADDED: Track last displayed formatted time ***

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
                    eventName: Events.Game.TimeUp, // Can still use this to mark time up style immediately
                    callback: this._handleTimeUp
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
     * Stores the active timer and starts the RAF update loop when the game starts.
     * @param {Object} payload - The event payload
     * @param {Timer} payload.timer - The active Timer instance for the game.
     * @param {Object} payload.settings - The game settings
     */
    _handleGameStart(payload) {
        this.show(); // Attempt to show, RefactoredBaseComponent handles null rootElement gracefully here

        // *** REMOVED Check: Adhering to rule - Trusting rootElement exists ***
        // if (!this.rootElement) { ... } 

        this.activeTimer = payload.timer; // Store the timer instance
        this._lastDisplayedTime = null; // Reset last displayed time

        if (!this.activeTimer) {
            console.error(`[${this.name}] Game started but no timer instance provided in payload!`);
            this.clearTimer(); // clearTimer already checks for rootElement
            return;
        }
        
        // Clear any previous styling and display initial time
        // TRUSTING this.rootElement exists based on component contract
        this.rootElement.classList.remove(this.lowTimeClass, this.criticalTimeClass, this.timeUpClass);
        const initialTimeMs = this.activeTimer.getRemainingTime(); // Should reflect initial duration
        const initialFormattedTime = Timer.formatTime(initialTimeMs);
        this.rootElement.textContent = initialFormattedTime;
        this._lastDisplayedTime = initialFormattedTime; // Set initial displayed time

        // Start the update loop
        this._startUpdateLoop();
    }
    
    /** 
     * Stops the RAF loop and clears the display when the game ends.
     */
    _handleGameEnd() { 
        this._stopUpdateLoop();
        this.hide();
        this.clearTimer();
        this.activeTimer = null; // Clear reference
        this._lastDisplayedTime = null;
    }

    /**
     * Handles the TimeUp event to apply specific styling immediately.
     */
    _handleTimeUp() { 
        // Loop might already be stopped by RAF check, but ensure styling applied
        if (this.rootElement) { // Ensure element exists
            const formattedTime = Timer.formatTime(0);
            this.rootElement.textContent = formattedTime;
            this.rootElement.classList.remove(this.lowTimeClass, this.criticalTimeClass);
            this.rootElement.classList.add(this.timeUpClass);
            this._lastDisplayedTime = formattedTime; // Update last displayed time
        }
        // Don't stop the loop here, _handleGameEnd will do that.
    }

    /** 
     * Clears the timer display and resets styling.
     */
    clearTimer() {
        if (this.rootElement) { // Check if rootElement exists
            this.rootElement.textContent = this.defaultDisplay;
            this.rootElement.classList.remove(this.lowTimeClass, this.criticalTimeClass, this.timeUpClass);
            this._lastDisplayedTime = null; // Reset last displayed time
        }
    }

    /**
     * Starts the requestAnimationFrame loop for updating the timer display.
     * @private
     */
    _startUpdateLoop() {
        if (this._isLoopRunning) {
            return; // Prevent multiple loops
        }
        this._isLoopRunning = true;
        console.log(`[${this.name}] Starting RAF update loop.`);

        const update = () => {
            if (!this._isLoopRunning) {
                console.log(`[${this.name}] RAF loop stopping condition met (flag).`);
                return; // Stop if the flag is set (e.g., by _handleGameEnd)
            }

            if (this.activeTimer && this.rootElement) { // Check timer and element exist
                const remainingTimeMs = this.activeTimer.getRemainingTime();
                const isRunning = this.activeTimer.isRunning;
                const currentFormattedTime = Timer.formatTime(remainingTimeMs);

                // *** Check if formatted time or running state changed ***
                if (currentFormattedTime !== this._lastDisplayedTime) {
                    // Update display only if the timer is actually running OR time is up
                    if (isRunning || remainingTimeMs <= 0) {
                        this.rootElement.textContent = currentFormattedTime;
                        this._lastDisplayedTime = currentFormattedTime; // Update last displayed time

                        // Apply styling based on thresholds
                        const remainingSeconds = remainingTimeMs / 1000;
                        this.rootElement.classList.remove(this.lowTimeClass, this.criticalTimeClass, this.timeUpClass);
                        if (remainingSeconds <= 0.1) { // Use a small threshold to catch exact zero
                             // TimeUp event handler should set the final style
                             // We might add timeUpClass here for immediate visual feedback if TimeUp event is delayed
                             this.rootElement.classList.add(this.timeUpClass);
                        } else if (remainingSeconds <= this.criticalTimeThresholdSeconds) {
                             this.rootElement.classList.add(this.criticalTimeClass);
                        } else if (remainingSeconds <= this.lowTimeThresholdSeconds) {
                             this.rootElement.classList.add(this.lowTimeClass);
                        }
                    } 
                }
                // If timer exists but isn't running (e.g., between questions), do nothing to the display.
                // It will show the last value or the initial value.
                
                // If time is up but loop is still running, ensure TimeUp style is applied
                // This handles cases where Game.TimeUp might not have fired yet
                if (!isRunning && remainingTimeMs <= 0 && !this.rootElement.classList.contains(this.timeUpClass)) {
                     this._handleTimeUp();
                }

            } else {
                // Clear display if timer is somehow lost during the loop
                 this.clearTimer(); 
            }

            // Continue the loop
            this.rafId = requestAnimationFrame(update);
        };

        // Initial call to start the loop
        this.rafId = requestAnimationFrame(update);
    }

    /**
     * Stops the requestAnimationFrame loop.
     * @private
     */
    _stopUpdateLoop() {
        console.log(`[${this.name}] Stopping RAF update loop.`);
        this._isLoopRunning = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
    
    /**
     * Overrides destroy to ensure RAF loop is cancelled.
     */
    destroy() {
         this._stopUpdateLoop();
         super.destroy(); // Call parent destroy
    }
}

export default TimerDisplayComponent; 