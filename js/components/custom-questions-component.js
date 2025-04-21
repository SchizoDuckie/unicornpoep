import RefactoredBaseComponent from "./RefactoredBaseComponent.js";
import eventBus from "../core/event-bus.js";
import Events from "../core/event-constants.js";
import questionsManager from "../services/QuestionsManager.js";
import Views from "../core/view-constants.js";
import uiManager from '../ui/UIManager.js';
import { getTextTemplate } from "../utils/miscUtils.js";

/**
 * @class CustomQuestionsComponent
 * 
 * Manages the UI for creating, editing, listing, and deleting custom question sheets.
 * Uses dynamic input fields for question-answer pairs instead of a single textarea.
 */
export default class CustomQuestionsComponent extends RefactoredBaseComponent {
    static SELECTOR = '#customQuestionsManager';
    static VIEW_NAME = Views.CustomQuestions; // Use constant

    editingSheetId = null;

    /**
     * Initializes the component by setting up event listeners and DOM bindings.
     * @returns {object} Configuration object for RefactoredBaseComponent.
     */
    initialize() {
        return {
            events: [
                { eventName: Events.Menu.CustomQuestions.SaveSuccess, callback: this._handleSaveSuccess },
                { eventName: Events.Menu.CustomQuestions.DeleteSuccess, callback: this._handleDeleteSuccess },
                { eventName: Events.Menu.CustomQuestions.SheetLoadedForEdit, callback: this._populateFormForEdit },
                { eventName: Events.Navigation.ShowView, callback: this._handleShowView },
                // Removed Events.UI.CustomQuestions.SheetActionClicked
            ],
            domEvents: [
                { selector: "#saveCustomQuestionsButton", event: "click", handler: this._handleSaveClick },
                { selector: "#addQuestionPairButton", event: "click", handler: this._handleAddQuestionPairClick },
                { 
                    selector: ".backToMain", 
                    event: "click", 
                    emits: Events.Navigation.ShowView, 
                    payload: { viewName: Views.MainMenu }
                },
                // Delegated listener for remove buttons within the dynamic list
                { 
                    selector: "#questionAnswerPairsContainer", 
                    event: "click", 
                    handler: this._handleRemoveQuestionPairClick,
                    delegate: '.remove-pair-button' // Specific target within container
                },
                // Listener for edit/delete buttons within the existing sheet list
                { 
                    selector: "#customSheetList", 
                    event: "click", 
                    handler: this._handleListClick 
                }
            ],
            domElements: [
                { name: "sheetNameInput", selector: "#customSheetName", required: true },
                { name: "questionAnswerPairsContainer", selector: "#questionAnswerPairsContainer", required: true },
                { name: "customSheetListContainer", selector: "#customSheetList", required: true },
                { name: "sheetItemTemplate", selector: "#custom-sheet-item-template" },
                { name: "qaPairTemplate", selector: "#qa-pair-template" }
                // Removed questionsTextarea
            ]
        };
    }
    
    /**
     * Adds a new question-answer pair input group to the form.
     * @param {string} [question=''] - Optional initial question value.
     * @param {string} [answer=''] - Optional initial answer value.
     * @returns {HTMLElement|null} The newly added pair element or null if template fails.
     */
    _addQuestionPair(question = '', answer = '') {
        const template = this.elements.qaPairTemplate;
        const container = this.elements.questionAnswerPairsContainer;
        if (!template || !container) {
             console.error(`[${this.constructor.name}] Template or container missing for Q/A pair.`);
             return null;
        }

        try {
            const clone = template.content.cloneNode(true);
            const pairElement = clone.querySelector('.qa-pair');
            if (!pairElement) {
                console.error(`[${this.constructor.name}] '.qa-pair' not found in template.`);
                return null;
            }
            
            const questionInput = pairElement.querySelector('.question-input');
            const answerInput = pairElement.querySelector('.answer-input');

            if (questionInput) questionInput.value = question;
            if (answerInput) answerInput.value = answer;

            container.appendChild(clone);
            return pairElement; // Return the added element
        } catch (error) {
            console.error(`[${this.constructor.name}] Error cloning or appending Q/A pair template:`, error);
             eventBus.emit(Events.System.ShowFeedback, { 
                message: "Fout bij toevoegen vraag.", 
                level: "error" 
            });
            return null;
        }
    }

    /**
     * Handles the click event for the "Add Question" button.
     */
    _handleAddQuestionPairClick() {
       const newPairElement = this._addQuestionPair();
       if (newPairElement) {
           // Focus the new question input for better UX
           const questionInput = newPairElement.querySelector('.question-input');
           if (questionInput) {
               questionInput.focus();
           }
       }
    }
    
    /**
     * Handles the click event for the remove button on a question-answer pair.
     * Uses event delegation from the container.
     * @param {MouseEvent} event - The click event.
     */
    _handleRemoveQuestionPairClick(event) {
        // Strict check: Ensure this is a click event on the correct button
        if (event.type !== 'click' || !event.target.matches('.remove-pair-button')) {
            // Log if triggered by something unexpected, but don't proceed
            console.warn(`[CustomQuestionsComponent] _handleRemoveQuestionPairClick ignored unexpected event. Type: ${event.type}, Target:`, event.target);
            return; 
        }

        // event.target is the remove button due to delegate selector
        const pairElement = event.target.closest('.qa-pair');
        if (pairElement) {
            pairElement.remove();
        } else {
            // This shouldn't happen if the target is the button, but log if it does
             console.error(`[CustomQuestionsComponent] Could not find parent .qa-pair for remove button:`, event.target);
        }
    }

    /**
     * Handle clicks within the existing custom sheet list (#customSheetList).
     * Differentiates between edit and delete actions based on button class.
     * @param {MouseEvent} event - The click event.
     */
    _handleListClick(event) {
        const targetButton = event.target.closest("button");
        if (!targetButton) return;

        const sheetId = targetButton.dataset.sheetId;
        if (!sheetId) return;

        const listItem = targetButton.closest('.custom-sheet-item');
        // Find the sheet name robustly, provide fallback
        const sheetNameElement = listItem ? listItem.querySelector('.sheet-name') : null;
        const sheetName = sheetNameElement ? sheetNameElement.textContent.trim() : (sheetId || getTextTemplate('customQDeleteFallbackName'));

        if (targetButton.classList.contains("delete-button")) {
            this._handleDeleteClick(sheetId, sheetName); // Existing delete logic
        } else if (targetButton.classList.contains("edit-button")) {
            this._handleEditClick(sheetId); // Trigger edit flow
        }
    }

    /**
     * Handles the save button click. Validates inputs and emits an event to save the sheet.
     */
    _handleSaveClick() {
        const nameInput = this.elements.sheetNameInput;
        const sheetName = nameInput.value.trim();

        if (!sheetName) {
            eventBus.emit(Events.System.ShowFeedback, { 
                message: getTextTemplate('customQWarnName'), 
                level: "warn" 
            });
            nameInput.focus();
            return;
        }

        const pairsContainer = this.elements.questionAnswerPairsContainer;
        const pairElements = pairsContainer.querySelectorAll('.qa-pair');
        const questionsData = [];
        let firstInvalidInput = null;

        for (const pairElement of pairElements) {
            const questionInput = pairElement.querySelector('.question-input');
            const answerInput = pairElement.querySelector('.answer-input');
            
            if (!questionInput || !answerInput) continue; // Should not happen

            const question = questionInput.value.trim();
            const answer = answerInput.value.trim();

            // Skip pairs where both are empty
            if (!question && !answer) {
                continue;
            }

            // Validate: If one is filled, the other must be too
            if (!question) {
                 eventBus.emit(Events.System.ShowFeedback, { 
                    message: getTextTemplate('customQWarnQuestion'), 
                    level: "warn" 
                });
                 if (!firstInvalidInput) firstInvalidInput = questionInput;
                 questionInput.focus(); // Focus the problematic input
                 return; // Stop processing on first error
            }
             if (!answer) {
                 eventBus.emit(Events.System.ShowFeedback, { 
                    message: getTextTemplate('customQWarnQuestion'), 
                    level: "warn" 
                });
                if (!firstInvalidInput) firstInvalidInput = answerInput;
                answerInput.focus(); // Focus the problematic input
                 return; // Stop processing on first error
            }

            // Add valid pair
            questionsData.push({ question, answer });
        }
        
        // Focus the first invalid input if found after loop (though return should prevent this)
        if (firstInvalidInput) {
            firstInvalidInput.focus();
            return;
        }

        // Validate: Ensure at least one valid pair exists
        if (questionsData.length === 0) {
            eventBus.emit(Events.System.ShowFeedback, {
                message: getTextTemplate('customQWarnPairs') || "Voeg minstens één vraag/antwoord paar toe.", // Fallback text
                level: "warn"
            });
            // Optionally add a new empty pair here if desired
            // this._handleAddQuestionPairClick();
            return;
        }

        // Reconstruct the old text format for compatibility with QuestionsManager
        // TODO: Suggest refactoring QuestionsManager to accept [{question, answer}] array directly
        const questionsText = questionsData
            .map(pair => `${pair.question} => ${pair.answer}`)
            .join('\n');

        eventBus.emit(Events.UI.CustomQuestions.SaveClicked, {
            name: sheetName,
            questionsText,
            sheetId: this.editingSheetId
        });

        // Don't clear inputs immediately, wait for _handleSaveSuccess
    }

    /**
     * Handles successful sheet save. Reloads the list and clears the form.
     * @param {object} data - Save success data.
     * @param {string} data.sheetId - ID of the saved sheet.
     * @param {string} data.name - Name of the saved sheet.
     */
    _handleSaveSuccess({ sheetId, name }) {
        this.loadAndDisplaySheets(); // Refresh the list
        this.clearInputs(); // Clear the form now
         eventBus.emit(Events.System.ShowFeedback, { 
            message: `Lijst '${name}' opgeslagen!`, 
            level: "success" 
        });
    }

    /**
     * Clears the sheet name input and all dynamic question-answer pairs.
     * Resets the editing state.
     */
    clearInputs() {
        const nameInput = this.elements.sheetNameInput;
        const pairsContainer = this.elements.questionAnswerPairsContainer;

        if (nameInput) nameInput.value = "";
        if (pairsContainer) pairsContainer.innerHTML = ""; // Clear dynamic pairs
        
        this.editingSheetId = null;
    }

    /**
     * Clears the displayed list of existing custom sheets.
     */
    clearSheetList() {
        const container = this.elements.customSheetListContainer;
        if (container) {
            // Clear everything except the template if it's inside
            container.innerHTML = ''; 
            // Add back the placeholder if needed, or handle in loadAndDisplaySheets
        }
    }

    /**
     * Loads and displays all available custom question sheets in the list.
     */
    loadAndDisplaySheets() {
        this.clearSheetList();
        
        const container = this.elements.customSheetListContainer;
        const templateElement = this.elements.sheetItemTemplate; // Use the correct template

        if (!container || !templateElement) {
            console.error(`[${this.constructor.name}] Cannot load sheets: list container or item template not available.`);
            const placeholder = container?.querySelector('.list-placeholder');
             if (placeholder) {
                placeholder.textContent = getTextTemplate('customQListError');
                placeholder.style.display = 'block';
            }
            return;
        }

        try {
            const allSheets = questionsManager.getAvailableSheets();
            const customSheets = allSheets.filter(sheet => sheet.isCustom);

            if (customSheets.length === 0) {
                // Add placeholder text directly if list is empty
                container.innerHTML = `<p class="list-placeholder"><i>${getTextTemplate('customQListEmpty')}</i></p>`;
                return;
            }
            
            // Ensure placeholder is removed if we are adding items
            const existingPlaceholder = container.querySelector('.list-placeholder');
            if(existingPlaceholder) existingPlaceholder.remove();

            const listFragment = document.createDocumentFragment();

            customSheets.forEach(sheet => {
                const templateClone = templateElement.content.cloneNode(true);
                const listItem = templateClone.querySelector(".custom-sheet-item");
                
                if (!listItem) {
                     console.warn(`[${this.constructor.name}] '.custom-sheet-item' not found in template clone for sheet ID: ${sheet.id}`);
                    return; // Skip this sheet if template structure is wrong
                }

                listItem.dataset.sheetId = sheet.id;

                const nameSpan = listItem.querySelector(".sheet-name");
                if (nameSpan) nameSpan.textContent = sheet.name;

                const editButton = listItem.querySelector(".edit-button");
                if (editButton) {
                    editButton.dataset.sheetId = sheet.id;
                    // editButton.disabled = false; // **ENABLE the edit button**
                } else {
                     console.warn(`[${this.constructor.name}] Edit button not found for sheet ID: ${sheet.id}`);
                }

                const deleteButton = listItem.querySelector(".delete-button");
                if (deleteButton) {
                    deleteButton.dataset.sheetId = sheet.id;
                    // deleteButton.disabled = false; // Ensure enabled
                } else {
                     console.warn(`[${this.constructor.name}] Delete button not found for sheet ID: ${sheet.id}`);
                }

                listFragment.appendChild(templateClone);
            });

            container.appendChild(listFragment);
        } catch (error) {
             console.error(`[${this.constructor.name}] Error loading/displaying sheets:`, error);
            container.innerHTML = `<p class="list-placeholder"><i>${getTextTemplate('customQListError')}</i></p>`;
            eventBus.emit(Events.System.ShowFeedback, {
                message: getTextTemplate('customQLoadError'),
                level: "error"
            });
        }
    }

    /**
     * Handles the delete button click from the sheet list.
     * Shows a confirmation dialog before emitting the delete event.
     * @param {string} sheetId - ID of the sheet to delete.
     * @param {string} sheetName - Name of the sheet for the confirmation message.
     */
    _handleDeleteClick(sheetId, sheetName) {
        const confirmationDialog = uiManager.components.get('ConfirmationDialog');
        if (!confirmationDialog) {
             console.error(`[${this.constructor.name}] ConfirmationDialog component not found.`);
            eventBus.emit(Events.System.ShowFeedback, {
                message: "Kon verwijdering niet starten (dialoog niet gevonden).",
                level: "error"
            });
            return;
        }

        confirmationDialog.show({
            title: getTextTemplate('deleteSheetTitle') || "Lijst Verwijderen?", // Use template keys
            message: (getTextTemplate('deleteSheetMessage') || "Weet je zeker dat je de lijst '%NAME%' wilt verwijderen? Dit kan niet ongedaan worden gemaakt.").replace('%NAME%', sheetName),
            okText: getTextTemplate('deleteSheetOk') || "Verwijder",
            cancelText: getTextTemplate('deleteSheetCancel') || "Annuleren",
            context: { sheetId, sheetName }, // Pass context needed in callback
            onConfirm: (context) => {
                eventBus.emit(Events.UI.CustomQuestions.DeleteClicked, { 
                    sheetId: context.sheetId 
                });
            }
        });
    }

    /**
     * Handles successful sheet deletion by reloading the list.
     */
    _handleDeleteSuccess() {
        this.loadAndDisplaySheets(); // Refresh the list
         eventBus.emit(Events.System.ShowFeedback, { 
            message: "Lijst succesvol verwijderd.", 
            level: "info" 
        });
         // If the deleted sheet was being edited, clear the form
        if (this.editingSheetId && !questionsManager.getSheetById(this.editingSheetId)) {
            this.clearInputs();
        }
    }

    /**
     * Handles the edit button click from the sheet list.
     * Sets the editing state and requests the sheet data for editing.
     * @param {string} sheetId - ID of the sheet to edit.
     */
    _handleEditClick(sheetId) {
        if (this.editingSheetId === sheetId) return; // Avoid reloading if already editing

        this.clearInputs(); // Clear form before loading new one
        this.editingSheetId = sheetId;
        eventBus.emit(Events.UI.CustomQuestions.EditClicked, { sheetId }); // Request sheet data
        
        // Optionally scroll to the top of the edit area or focus the name input
        const nameInput = this.elements.sheetNameInput;
        if (nameInput) {
            nameInput.focus();
             // Scroll edit area into view if needed
             const editArea = this.rootElement.querySelector('.custom-questions-edit-area');
             if (editArea) editArea.scrollIntoView({ behavior: 'smooth' });
        }
    }

    /**
     * Populates the form with sheet data for editing after receiving it.
     * Parses the `questionsText` and creates Q/A input pairs.
     * @param {object} data - Sheet data.
     * @param {string} data.sheetId - ID of the sheet.
     * @param {string} data.name - Name of the sheet.
     * @param {string} data.questionsText - Questions text content (old format).
     */
    _populateFormForEdit({ sheetId, name, questionsText }) {
        // Ensure this callback is for the sheet we requested to edit
        if (sheetId !== this.editingSheetId) return; 
        
        const nameInput = this.elements.sheetNameInput;
        const pairsContainer = this.elements.questionAnswerPairsContainer;
        
        if (!nameInput || !pairsContainer) {
             console.error(`[${this.constructor.name}] Cannot populate form: name input or pairs container missing.`);
             return;
        }

        nameInput.value = name;
        pairsContainer.innerHTML = ""; // Clear existing pairs first

        // Parse the old format
        const lines = questionsText.split('\n');
        let pairsAdded = 0;
        lines.forEach(line => {
            const parts = line.split('=>');
            if (parts.length === 2) {
                const question = parts[0].trim();
                const answer = parts[1].trim();
                if (question || answer) { // Add if at least one part has content
                    this._addQuestionPair(question, answer);
                    pairsAdded++;
                }
            } else if (line.trim()) {
                 console.warn(`[${this.constructor.name}] Skipping invalid line during edit load: "${line}"`);
            }
        });
        
         // If parsing resulted in no pairs (e.g., empty or invalid sheet), add one empty row
         if (pairsAdded === 0) {
            this._addQuestionPair();
         }

        // Set editingSheetId again just to be safe, though _handleEditClick should have set it
        this.editingSheetId = sheetId; 
    }

    /**
     * Handles the navigation event to show or hide this component's view.
     * Loads the sheet list when the view is shown.
     * @param {object} data - Navigation data.
     * @param {string} data.viewName - Name of the view to show.
     */
    _handleShowView({ viewName }) {
        if (viewName === CustomQuestionsComponent.VIEW_NAME) {
            this.loadAndDisplaySheets();
            this.clearInputs(); // Start with a clean form
            // Add one empty Q/A pair to start
            this._addQuestionPair(); 
            this.show();
        } else {
            // No need to clear inputs/list here if we do it on show and save/delete success
            this.hide();
        }
    }

    // Removed _handleSheetAction as it's no longer needed
} 