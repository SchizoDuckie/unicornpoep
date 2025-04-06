/**
 * Base class for managing common dialog functionality.
 * Handles element lookup, basic show/hide, and mainMenu reference.
 */
class BaseDialog {
    /**
     * @param {string} dialogId - The HTML ID of the dialog element.
     * @param {MainMenu} mainMenuController - The central orchestrator instance.
     */
    constructor(dialogId, mainMenuController) {
        if (!dialogId) {
            throw new Error("BaseDialog requires a dialogId.");
        }
        if (!mainMenuController) {
            // Allow creation without mainMenuController for simpler dialogs if needed,
            // but log a warning if it's expected for interaction.
            console.warn(`BaseDialog: mainMenuController not provided for dialog '${dialogId}'. Interactions requiring it will fail.`);
        }

        console.log(`BaseDialog Constructor: Attempting to find element with ID: '${dialogId}'`);
        
        this.dialogElement = document.getElementById(dialogId);
        this.mainMenuController = mainMenuController; // Use a consistent name

        if (!this.dialogElement) {
            console.error(`BaseDialog: Dialog element with ID '${dialogId}' not found!`);
            // Cannot proceed without the element
            throw new Error(`Dialog element with ID '${dialogId}' not found!`);
        }

        // Basic close listener (e.g., for ESC key)
        // Subclasses might override or add specific close behavior
        this.dialogElement.addEventListener('close', () => this.onClose());
    }

    /**
     * Shows the dialog. Removes 'hidden' class and calls showModal().
     * Ensures the dialog is not already open.
     */
    show() {
        if (!this.dialogElement) return;
        console.log(`BaseDialog: Showing dialog '${this.dialogElement.id}'.`);
        this.dialogElement.classList.remove('hidden');
        // Only call showModal if it's not already open
        if (!this.dialogElement.open) {
            try {
                this.dialogElement.showModal();
            } catch (e) {
                 console.error(`Error calling showModal for ${this.dialogElement.id}:`, e);
            }
        }
    }

    /**
     * Hides the dialog. Calls close() and adds 'hidden' class.
     */
    hide() {
        if (!this.dialogElement) return;
        console.log(`BaseDialog: Hiding dialog '${this.dialogElement.id}'.`);
        // Close if open
        if (this.dialogElement.open) {
             try {
                 this.dialogElement.close();
             } catch (e) {
                 console.warn(`Error calling close for ${this.dialogElement.id}:`, e);
             }
        }
        // Always ensure hidden class is present
        this.dialogElement.classList.add('hidden');
    }

    /**
     * Basic handler for the 'close' event (e.g., ESC key).
     * Subclasses can override this for specific cleanup or actions.
     */
    onClose() {
        console.log(`BaseDialog: Dialog '${this.dialogElement.id}' closed.`);
        // Ensure hidden class is added on any close event
        this.dialogElement.classList.add('hidden');
    }

    /**
     * Checks if the dialog is currently open.
     * @returns {boolean}
     */
    isOpen() {
        return this.dialogElement.open ?? false;
    }

    /**
     * Helper to get an element within the dialog.
     * @param {string} selector - CSS selector for the element.
     * @returns {HTMLElement|null}
     */
    querySelector(selector) {
        return this.dialogElement.querySelector(selector);
    }

    /**
     * Helper to get multiple elements within the dialog.
     * @param {string} selector - CSS selector for the elements.
     * @returns {NodeListOf<HTMLElement>}
     */
    querySelectorAll(selector) {
        return this.dialogElement.querySelectorAll(selector);
    }
} 