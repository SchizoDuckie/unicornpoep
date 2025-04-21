import RefactoredBaseComponent from '../components/RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

/**
 * Class BaseDialog.
 * 
 * Base class for dialog components that use the HTML <dialog> element.
 * Extends RefactoredBaseComponent and overrides show/hide to use showModal/close.
 * Assumes the root element is a <dialog>.
 * 
 * @property {HTMLDialogElement} rootElement The dialog HTML element
 * @property {boolean} isVisible Whether the dialog is currently visible
 */
export default class BaseDialog extends RefactoredBaseComponent {

    /**
     * Base constructor for dialogs. Subclasses should NOT override this.
     * They MUST define static SELECTOR and static VIEW_NAME properties.
     */
    constructor() {
        super(); // Call RefactoredBaseComponent constructor

        // Post-initialization check specific to dialogs
        if (this.rootElement && !(this.rootElement instanceof HTMLDialogElement)) {
            console.warn(`[${this.name}] Root element ${this.selector} is not a <dialog> element. showModal/close might fail.`);
        }
        
        // Initial state is handled by RefactoredBaseComponent checking the 'hidden' class.
        // Dialogs often start visible in HTML until explicitly hidden by JS.
        // Ensure they are hidden (closed) after initialization if not already.
        if (this.rootElement instanceof HTMLDialogElement && this.rootElement.open) {
            this.hide();
        }
    }

    /**
     * Shows the dialog using showModal() and emits Shown event.
     * Overrides RefactoredBaseComponent.show().
     * 
     * @param {Object} [data={}] Optional data to pass to the Shown event
     * @return void
     */
    show(data = {}) {
        
        if (this.rootElement instanceof HTMLDialogElement) {
        
            this.rootElement.classList.add('active'); 
            this.rootElement.classList.remove('hidden'); 
            
            if (!this.rootElement.open) {
                this.rootElement.showModal();
    
                this.isVisible = true; // Update internal state
                eventBus.emit(Events.Component.Shown, { component: this, componentName: this.name, data });
                console.debug(`[BaseDialog] Shown (modal): ${this.name}`);
            }
        } else {
            console.warn(`[${this.name}] Cannot show dialog: Element not found or not a dialog.`);
        }
    }

    /**
     * Hides the dialog using close() and emits Hidden event.
     * Overrides RefactoredBaseComponent.hide().
     * 
     * @return void
     */
    hide() {
        if (this.rootElement instanceof HTMLDialogElement) {
            if (this.rootElement.open) {
                try {
                    this.rootElement.close();
                    this.isVisible = false; // Update internal state
                    eventBus.emit(Events.Component.Hidden, { component: this, componentName: this.name });
                    console.debug(`[BaseDialog] Hidden (closed): ${this.name}`);
                } catch (error) {
                    console.error(`[${this.name}] Error closing dialog modal:`, error);
                    // Don't re-add hidden class here if close failed, state is uncertain
                }
            } 
            this.rootElement.classList.add('hidden'); 
            this.rootElement.classList.remove('active'); 
            this.isVisible = false; // Ensure state is false even if wasn't open
            if (this.rootElement.hasAttribute('open')) {
                this.rootElement.removeAttribute('open');
            }
        } 
        // No warning if already closed, as hide() might be called defensively.
    }
    
    /**
     * Adds a listener for a standard close button within the dialog.
     * Assumes a button with the class '.dialog-close-button'.
     * Call this in the setup function of inheriting dialogs if needed.
     * 
     * @param {string} [buttonSelector='.dialog-close-button'] CSS selector for the close button
     * @return void
     * @protected
     */
    addCloseButtonListener(buttonSelector = '.dialog-close-button') {
        const closeButton = this.rootElement.querySelector(buttonSelector);
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log(`[${this.name}] Close button clicked.`);
                this.hide();
                // Optionally emit a specific cancel/close event
                // eventBus.emit(`ui:${this.name}:closed`); 
            });
        } else {
            console.debug(`[${this.name}] No close button found with selector: ${buttonSelector}`);
        }
    }

    /**
     * Utility method to get translation text from the DOM.
     * 
     * @param {string} key The translation key to look for
     * @param {string} [defaultValue=null] Optional default value if key is not found
     * @return {string|null} The translation text or defaultValue if not found
     * @protected
     */
    _getTextTemplate(key, defaultValue = null) {
        try {
            const element = document.querySelector(`[data-translation-key="${key}"]`);
            return element ? element.textContent : defaultValue;
        } catch (error) {
            console.warn(`[${this.name}] Error getting text template for key ${key}:`, error);
            return defaultValue;
        }
    }
} 