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
     * @throws {Error} If eventName is not a valid, non-empty string.
     * @throws {Error} If callback is not a function.
     */
    on(eventName, callback) {

        // --- Input Validation --- 
        if (typeof eventName !== 'string' || !eventName) {
            const error = new Error(`[EventBus] Invalid event name provided for registration: Must be a non-empty string, received: ${eventName}`);
            if (error.stack) {
                console.error("Invalid event registration attempt from:", error.stack);
            }
            throw error;
        }
        if (typeof callback !== 'function') {
            const error = new Error(`[EventBus] Invalid callback provided for event '${eventName}'. Must be a function, received: ${typeof callback}`);
            if (error.stack) {
                console.error("Invalid event registration attempt from:", error.stack);
            }
            throw error;
        }
        // --- End Validation --- 
        
        // Log all event registrations
        console.log(`[EventBus] Registering: '${eventName}'`, typeof callback === 'function' ? '' : callback);
        
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        if (!this.listeners[eventName].includes(callback)) {
            this.listeners[eventName].push(callback);
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
     * Checks if an event is in the whitelist of events allowed without listeners.
     * @param {string} eventName - The name of the event to check.
     * @returns {boolean} - True if the event is whitelisted.
     * @private
     */
    _isWhitelisted(eventName) {
        return this.whitelistedEvents.includes(eventName);
    }

    /**
     * Emits an event, triggering all registered listeners.
     * @param {string} eventName - The name of the event to emit.
     * @param {...any} args - Arguments to pass to the listener functions.
     * @throws {Error} When a non-whitelisted event is emitted with no listeners (fail fast approach)
     */
    emit(eventName, ...args) {
        if(eventName !== Events.Game.TimeTick) {
            console.log(`Emitting event: ${eventName} (${JSON.stringify(args)})`);
        }
        // --- Immediate check for invalid eventName ---
        if (typeof eventName !== 'string' || !eventName) {
            const error = new Error(`[EventBus] Attempted to emit an invalid event: ${eventName}`, arguments);
            if (error.stack) {
                 console.error("Invalid emit called from:", error.stack);
            }
            debugger;
            throw error;
        }

        const eventListeners = this.listeners[eventName];
        if (eventListeners) {
            // Iterate over a copy in case listeners modify the array during execution
            [...eventListeners].forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[EventBus] Error in listener for '${eventName}':`, error, "Payload:", args);
                }
            });
        } else {
            console.debug(`[EventBus] Event '${eventName}' emitted with no listeners. `, args);
        }
    }
}

// Create and export the singleton instance
const eventBus = new EventBus();
Object.freeze(eventBus); // Prevent modification of the instance

export default eventBus; 