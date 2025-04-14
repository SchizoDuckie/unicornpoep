import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';

const KONAMI_SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];

/**
 * Handles activation and management of the Konami code easter egg.
 */
class EasterEggActivator {
    constructor() {
        this._konamiCurrentPosition = 0;
        this._confettiMouseDownTime = 0;
        this._konamiListenerActive = false;
        this._confettiListenersActive = false;

        // Bind methods to ensure correct `this` context in listeners
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleMouseDown = this._handleMouseDown.bind(this);
        this._handleMouseUp = this._handleMouseUp.bind(this);
    }

    /** Adds the Konami code listener to the document. */
    addKonamiListener() {
        if (this._konamiListenerActive) return;
        // Ensure confetti isn't already active
        if (this._confettiListenersActive) return;

        document.addEventListener('keydown', this._handleKeyDown);
        this._konamiListenerActive = true;
        this._konamiCurrentPosition = 0; // Reset sequence position
        console.debug("[EasterEggActivator] Konami listener added.");
    }

    /** Removes the Konami code listener from the document. */
    removeKonamiListener() {
        if (!this._konamiListenerActive) return;
        document.removeEventListener('keydown', this._handleKeyDown);
        this._konamiListenerActive = false;
        console.debug("[EasterEggActivator] Konami listener removed.");
    }

    /**
     * Handles keydown events to check for the Konami code.
     * @param {KeyboardEvent} event
     * @private
     */
    _handleKeyDown(event) {
        if (event.code === KONAMI_SEQUENCE[this._konamiCurrentPosition]) {
            this._konamiCurrentPosition++;
            if (this._konamiCurrentPosition === KONAMI_SEQUENCE.length) {
                console.log("KONAMI CODE DETECTED!");
                this._enableConfettiOnClick(); // Activate easter egg
                this._konamiCurrentPosition = 0; // Reset
            }
        } else {
            // Reset if the key is wrong, but ignore irrelevant keys (like Shift, etc.)
            if (!event.key.startsWith('Arrow')) {
                 // Don't reset for modifier keys, allow sequence continuation
            } else {
                 this._konamiCurrentPosition = 0;
            }
        }
    }

    /**
     * Enables the click-to-confetti easter egg listeners.
     * @private
     */
    _enableConfettiOnClick() {
        if (this._confettiListenersActive) return;
        if (typeof confetti !== 'function') {
            console.warn("[EasterEggActivator] Confetti library not found. Easter egg disabled.");
            return;
        }
        console.log("[EasterEggActivator] Enabling click-to-confetti easter egg.");

        window.addEventListener('mousedown', this._handleMouseDown);
        window.addEventListener('mouseup', this._handleMouseUp);
        this._confettiListenersActive = true;

        // Remove Konami listener once activated
        this.removeKonamiListener();

        // Use template for feedback message
        eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('easterEggActivated'), level: 'success', duration: 5000 });
    }

    /** Removes the confetti listeners. */
    removeConfettiListeners() {
        if (!this._confettiListenersActive) return;
        window.removeEventListener('mousedown', this._handleMouseDown);
        window.removeEventListener('mouseup', this._handleMouseUp);
        this._confettiListenersActive = false;
        console.debug("[EasterEggActivator] Confetti listeners removed.");
    }

    /** Stores mouse down time for confetti duration. @private */
    _handleMouseDown() {
        this._confettiMouseDownTime = Date.now();
    }

    /** Triggers confetti on mouse up. @param {MouseEvent} e @private */
    _handleMouseUp(e) {
        // Ensure the confetti function exists globally
         if (typeof confetti !== 'function') return;

        const confettiAmount = Date.now() - this._confettiMouseDownTime;
        console.debug("Confetti click duration:", confettiAmount);

        const particleCount = Math.min(200, 10 + Math.floor(confettiAmount / 10));
        const xPosition = e.clientX / window.innerWidth;
        const yPosition = e.clientY / window.innerHeight;

        confetti({
            particleCount: particleCount,
            spread: 70,
            origin: { x: xPosition, y: yPosition },
            gravity: 0.8
        });
    }

    /** Deactivates all listeners managed by this instance. */
    deactivate() {
        this.removeKonamiListener();
        this.removeConfettiListeners();
    }
}

// Export a singleton instance or the class itself depending on usage
// Singleton might be easier if only one place activates it at a time
const easterEggActivator = new EasterEggActivator();
export default easterEggActivator; 