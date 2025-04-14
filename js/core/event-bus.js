import Events from './event-constants.js';

/**
 * A simple event bus implementation for decoupling components.
 * Follows the singleton pattern.
 */
class EventBus {
    /**
     * Initializes the listener map.
     */
    constructor() {
        if (EventBus.instance) {
            return EventBus.instance;
        }
        this.listeners = {};
        EventBus.instance = this;
        console.info("[EventBus] Singleton instance created.");
    }

    /**
     * Registers a listener for a specific event.
     * @param {string} eventName - The name of the event to listen for (use constants from event-constants.js).
     * @param {Function} callback - The function to execute when the event is emitted.
     */
    on(eventName, callback) {
        // --- ADD DEBUGGING --- 
        if (eventName === Events.Multiplayer.Host.Initialized) {
            console.log(`[EventBus DEBUG] Registering listener for ${eventName}. Callback:`, callback);
            if (typeof callback !== 'function') {
                console.error(`[EventBus DEBUG] ATTEMPTING TO REGISTER NON-FUNCTION LISTENER FOR ${eventName}`, callback);
                // Optionally add a stack trace
                console.trace('Stack trace for non-function registration:');
            }
        }
        // --- END DEBUGGING ---
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        if (!this.listeners[eventName].includes(callback)) {
            this.listeners[eventName].push(callback);
            // console.debug(`[EventBus] Listener added for '${eventName}'`);
        } else {
            console.warn(`[EventBus] Listener already registered for '${eventName}'`);
        }
    }

    /**
     * Removes a listener for a specific event.
     * @param {string} eventName - The name of the event.
     * @param {Function} callback - The specific listener function to remove.
     */
    off(eventName, callback) {
        if (this.listeners[eventName]) {
            const index = this.listeners[eventName].indexOf(callback);
            if (index > -1) {
                this.listeners[eventName].splice(index, 1);
                // console.debug(`[EventBus] Listener removed for '${eventName}'`);
                if (this.listeners[eventName].length === 0) {
                    delete this.listeners[eventName];
                }
            }
        }
    }

    /**
     * Emits an event, triggering all registered listeners.
     * @param {string} eventName - The name of the event to emit.
     * @param {...any} args - Arguments to pass to the listener functions.
     */
    emit(eventName, ...args) {
        // Option 1: Reduce level (less visible in default console)
        // console.trace(`[EventBus] Emitting: '${eventName}'`, args); 

        // Option 2: Skip logging for specific events
        if (eventName !== Events.Game.TimeTick) { 
            console.debug(`[EventBus] Emitting: '${eventName}'`, args);
        } else {
            // Optionally trace tick events if needed for deep debugging
            // console.trace(`[EventBus] Emitting: '${eventName}'`, args);
        }

        const eventListeners = this.listeners[eventName];
        if (eventListeners) {
            // Iterate over a copy in case listeners modify the array during execution
            [...eventListeners].forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[EventBus] Error in listener for '${eventName}':`, error, "Payload:", args);
                    // Optionally emit a system error event here later
                    // this.emit(Events.System.ErrorOccurred, { message: `Listener error for ${eventName}`, error, context: 'EventBus' });
                }
            });
        }
    }
}

// Create and export the singleton instance
const eventBus = new EventBus();
Object.freeze(eventBus); // Prevent modification of the instance

export default eventBus; 