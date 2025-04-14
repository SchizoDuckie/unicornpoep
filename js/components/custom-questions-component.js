import BaseComponent from "./base-component.js";
import eventBus from "../core/event-bus.js";
import Events from "../core/event-constants.js";
import questionsManager from "../services/QuestionsManager.js"; // Import the service
import Views from "../core/view-constants.js";
import uiManager from '../ui/UIManager.js'; // Import UIManager for dialog access
import { getTextTemplate } from "../utils/miscUtils.js"; // Import the utility
/**
 * Component managing the Custom Questions view (#customQuestionsManager).
 * Handles input for creating/editing question lists and displays existing ones.
 */
export default class CustomQuestionsComponent extends BaseComponent {
    static SELECTOR = '#customQuestionsManager';
    static VIEW_NAME = 'CustomQuestionsComponent';

    /** Initializes the component. */
    constructor() {
        super();
        console.log("[CustomQuestionsComponent] Constructed (via BaseComponent).");
    }

    /** 
     * Initializes component elements and binds methods/listeners.
     * Called by BaseComponent constructor.
     */
    initialize() {
        this.sheetNameInput = this.rootElement.querySelector("#customSheetName");
        this.questionsTextarea = this.rootElement.querySelector("#customQuestionsTextarea");
        this.saveButton = this.rootElement.querySelector("#saveCustomQuestionsButton");
        this.backButton = this.rootElement.querySelector(".backToMain");
        this.customSheetListContainer = this.rootElement.querySelector("#customSheetList");
        this.sheetItemTemplate = this.rootElement.querySelector("#custom-sheet-item-template");

        // Store the ID of the sheet being edited
        this.editingSheetId = null;

        if (!this.sheetNameInput || !this.questionsTextarea || !this.saveButton || !this.backButton || !this.customSheetListContainer || !this.sheetItemTemplate) {
            console.error("[CustomQuestionsComponent] Missing required elements within #customQuestionsManager (incl #customSheetList, #custom-sheet-item-template). Component cannot function.");
            // Let BaseComponent handle potential errors from missing root, but maybe return early?
             return;
        }

        this._handleSaveClick = this._handleSaveClick.bind(this);
        this._handleBackClick = this._handleBackClick.bind(this);
        this._handleListClick = this._handleListClick.bind(this);
        this._handleSaveSuccess = this._handleSaveSuccess.bind(this);
        this._handleSaveFailed = this._handleSaveFailed.bind(this);
        this._handleDeleteSuccess = this._handleDeleteSuccess.bind(this);
        this._handleDeleteFailed = this._handleDeleteFailed.bind(this);
        this._populateFormForEdit = this._populateFormForEdit.bind(this);
        this._handleShowView = this._handleShowView.bind(this);

        console.log("[CustomQuestionsComponent] Initialized elements & global listeners.");
    }

    /** Registers DOM and eventBus listeners using pre-bound handlers. */
    registerListeners() {
        console.log(`[${this.name}] Registering listeners.`);
        
        // DOM Listeners
        if (this.saveButton) this.saveButton.addEventListener("click", this._handleSaveClick);
        if (this.backButton) this.backButton.addEventListener("click", this._handleBackClick);
        if (this.customSheetListContainer) this.customSheetListContainer.addEventListener("click", this._handleListClick);

        // eventBus Listeners
        this.listen(Events.Menu.CustomQuestions.SaveSuccess, this._handleSaveSuccess);
        this.listen(Events.Menu.CustomQuestions.SaveFailed, this._handleSaveFailed);
        this.listen(Events.Menu.CustomQuestions.DeleteSuccess, this._handleDeleteSuccess);
        this.listen(Events.Menu.CustomQuestions.DeleteFailed, this._handleDeleteFailed);
        this.listen(Events.Menu.CustomQuestions.SheetLoadedForEdit, this._populateFormForEdit);
        this.listen(Events.Navigation.ShowView, this._handleShowView);
    }

    /**
     * Handles back button click.
     * @private
     */
    _handleBackClick() {
        console.log("[CustomQuestionsComponent] Back button clicked.");
        // Assuming BackClicked event is not crucial if we navigate directly
        // eventBus.emit(Events.UI.CustomQuestions.BackClicked);
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Handles clicks within the custom sheet list using event delegation.
     * @param {Event} event
     * @private
     */
    _handleListClick(event) {
        const targetButton = event.target.closest("button");
        if (!targetButton) return; // Click wasn't on a button or its descendant

        const sheetId = targetButton.dataset.sheetId;
        const listItem = targetButton.closest('.custom-sheet-item');
        const sheetName = listItem?.querySelector('.sheet-name')?.textContent || sheetId || getTextTemplate('customQDeleteFallbackName');
        if (!sheetId) return; // Button doesn't have a sheet ID

        if (targetButton.classList.contains("delete-button")) {
            this._handleDeleteClick(sheetId, sheetName);
        } else if (targetButton.classList.contains("edit-button")) {
            this._handleEditClick(sheetId);
        }
    }

    /**
     * Handles the click on the Save button.
     * Emits a UI save event with raw text for the coordinator/manager to parse.
     * @private
     */
    _handleSaveClick() {
        const sheetName = this.sheetNameInput.value.trim();
        const questionsText = this.questionsTextarea.value.trim(); // Get raw text

        // Basic validation
        if (!sheetName) {
            // Use template for warning
            eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('customQWarnName'), level: "warn" }); 
            this.sheetNameInput.focus();
            return;
        }
        if (!questionsText) {
            // Use template for warning
            eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('customQWarnQuestion'), level: "warn" }); 
            this.questionsTextarea.focus();
            return;
        }

        console.log(`[CustomQuestionsComponent] Save button clicked. Emitting UI.CustomQuestions.SaveClicked. Name: ${sheetName}`);
        // Emit UI event with RAW TEXT for the coordinator/manager
        eventBus.emit(Events.UI.CustomQuestions.SaveClicked, {
            name: sheetName,
            questionsText: questionsText, // Send raw text
            sheetId: this.editingSheetId
        });

        // Optimistically clear inputs (feedback handled by coordinator)
        this.clearInputs();
        // Trigger refresh of the displayed list (handled by coordinator via SaveSuccess)
        // this.loadAndDisplaySheets(); // Removed, list refreshed on SaveSuccess event
        this.editingSheetId = null;
    }

    /**
     * Handles successful save of a custom sheet (event from coordinator).
     * @param {object} payload - Event payload from Menu.CustomQuestions.SaveSuccess
     * @param {string} payload.sheetId
     * @param {string} payload.name
     * @private
     */
    _handleSaveSuccess({ sheetId, name }) {
        console.log(`[CustomQuestionsComponent] Received SaveSuccess for ${name} (${sheetId}). Triggering list refresh.`);
        // Inputs should already be clear from handleSaveClick, but clear again just in case.
        this.clearInputs();
        // Trigger refresh of the displayed list
        this.loadAndDisplaySheets();
    }

    /**
     * Handles failed save of a custom sheet (event from coordinator).
     * @param {object} payload - Event payload from Menu.CustomQuestions.SaveFailed
     * @param {string} payload.message
     * @private
     */
    _handleSaveFailed({ message }) {
        console.warn(`[CustomQuestionsComponent] Received SaveFailed. Message: ${message}`);
        // Feedback is already shown via ShowFeedback event from coordinator.
        // Could potentially add specific UI state changes here (e.g., re-enable save button if disabled).
    }

    /**
     * Clears the input fields.
     * @private
     */
    clearInputs() {
        if (this.sheetNameInput) this.sheetNameInput.value = "";
        if (this.questionsTextarea) this.questionsTextarea.value = "";
        // Reset the editing state when clearing inputs manually (e.g., after save)
        this.editingSheetId = null;
        console.debug("[CustomQuestionsComponent] Inputs cleared.");
    }

    /**
     * Clears the displayed list of custom sheets.
     * @private
     */
    clearSheetList() {
        if (this.customSheetListContainer) {
            this.customSheetListContainer.innerHTML = ""; // Clear existing list
            console.debug("[CustomQuestionsComponent] Custom sheet list cleared.");
        }
    }

    /**
     * Placeholder for the method that will load available custom sheets
     * (likely by calling QuestionsManager.getAvailableSheets() filtering for custom)
     * and render them to the list container.
     * @private
     */
    loadAndDisplaySheets() {
        console.debug("[CustomQuestionsComponent] Loading and displaying custom sheets using template...");
        if (!this.customSheetListContainer || !this.sheetItemTemplate) return;

        this.clearSheetList(); // Ensure it's empty before rendering

        try {
            const allSheets = questionsManager.getAvailableSheets();
            const customSheets = allSheets.filter(sheet => sheet.isCustom);

            if (customSheets.length === 0) {
                 // Use template for empty list message
                this.customSheetListContainer.innerHTML = `<p><i>${getTextTemplate('customQListEmpty')}</i></p>`; 
                return;
            }

            const listFragment = document.createDocumentFragment(); // Use fragment for performance

            customSheets.forEach(sheet => {
                // Clone the template content
                const templateClone = this.sheetItemTemplate.content.cloneNode(true);

                // Get the list item element from the clone
                const listItem = templateClone.querySelector(".custom-sheet-item");
                if (!listItem) {
                    console.warn("[CustomQuestionsComponent] Could not find .custom-sheet-item in template clone.");
                    return; // Skip this item
                }

                // Set the sheet ID on the list item
                listItem.dataset.sheetId = sheet.id;

                // Find and populate elements within the clone
                const nameSpan = listItem.querySelector(".sheet-name");
                if (nameSpan) nameSpan.textContent = sheet.name;

                const editButton = listItem.querySelector(".edit-button");
                if (editButton) {
                    editButton.dataset.sheetId = sheet.id;
                    editButton.disabled = true; // TODO: Implement edit functionality
                }

                const deleteButton = listItem.querySelector(".delete-button");
                if (deleteButton) {
                    deleteButton.dataset.sheetId = sheet.id;
                    deleteButton.disabled = false; // Enable delete button
                }

                // Append the populated clone to the fragment
                listFragment.appendChild(templateClone); // Append the whole template clone which contains the li
            });

            // Append the fragment containing all list items to the container
            this.customSheetListContainer.appendChild(listFragment);

        } catch (error) {
            console.error("[CustomQuestionsComponent] Error loading or displaying custom sheets:", error);
            // Use template for list error message
            this.customSheetListContainer.innerHTML = `<p><i>${getTextTemplate('customQListError')}</i></p>`; 
            // Use template for feedback error message
            eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('customQLoadError'), level: "error" }); 
        }
    }

    /**
     * Handles the click on a delete button for a specific sheet.
     * Shows a confirmation dialog before emitting the delete event.
     * @param {string} sheetId - The ID of the sheet to delete.
     * @param {string} sheetName - The name of the sheet for the confirmation message.
     * @private
     */
    _handleDeleteClick(sheetId, sheetName) {
        console.log(`[CustomQuestionsComponent] Delete button clicked for: ${sheetName} (${sheetId})`);

        const confirmationDialog = uiManager.components.get('ConfirmationDialog');
        if (!confirmationDialog) {
            console.error("[CustomQuestionsComponent] ConfirmationDialog not found!");
            // Fallback or show error
            eventBus.emit(Events.System.ShowFeedback, { message: "Kon verwijdering niet starten.", level: "error" });
            return;
        }

        confirmationDialog.show({
            // Read text from HTML later
            title: "Lijst Verwijderen?",
            message: `Weet je zeker dat je de lijst '${sheetName}' wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`,
            okText: "Verwijder",
            cancelText: "Annuleren",
            context: { sheetId: sheetId, sheetName: sheetName }, // Pass context
            onConfirm: (context) => {
                console.log(`[CustomQuestionsComponent] Delete confirmed for ${context.sheetName}, emitting UI event.`);
                eventBus.emit(Events.UI.CustomQuestions.DeleteClicked, { sheetId: context.sheetId });
            },
            onCancel: (context) => {
                 console.log(`[CustomQuestionsComponent] Delete cancelled for ${context.sheetName}.`);
            }
        });
    }

    /**
     * Handles successful deletion of a custom sheet.
     * @param {object} payload
     * @param {string} payload.sheetId
     * @private
     */
    _handleDeleteSuccess({ sheetId }) {
        console.log(`[CustomQuestionsComponent] Received DeleteSuccess for ${sheetId}. Refreshing list.`);
        // Refresh the list to remove the deleted item
        this.loadAndDisplaySheets();
    }

    /**
     * Handles failed deletion of a custom sheet.
     * @param {object} payload
     * @param {string} payload.sheetId
     * @param {string} payload.message
     * @private
     */
    _handleDeleteFailed({ sheetId, message }) {
        console.warn(`[CustomQuestionsComponent] Received DeleteFailed for ${sheetId}. Message: ${message}`);
        // Feedback is handled by coordinator's ShowFeedback.
        // Might want to add UI specific feedback here if needed.
    }

    /**
     * Handles the click on an edit button (Placeholder).
     * @param {string} sheetId
     * @private
     */
    _handleEditClick(sheetId) {
        console.log(`[CustomQuestionsComponent] Edit button clicked for sheet: ${sheetId}`);
        // Set the editing state
        this.editingSheetId = sheetId;
        // Emit an event for the coordinator to fetch the sheet data
        eventBus.emit(Events.UI.CustomQuestions.EditClicked, { sheetId });
        // Optionally, scroll to the top or focus the name input
        this.sheetNameInput.focus();
    }

    /**
     * Populates the form fields when sheet data is loaded for editing.
     * Listens for Menu.CustomQuestions.SheetLoadedForEdit event from the coordinator.
     * @param {object} payload
     * @param {string} payload.sheetId - The ID of the sheet being edited.
     * @param {string} payload.name - The name of the sheet.
     * @param {string} payload.questionsText - The raw questions text.
     * @private
     */
    _populateFormForEdit({ sheetId, name, questionsText }) {
        if (sheetId !== this.editingSheetId) {
            console.warn(`[CustomQuestionsComponent] Received SheetLoadedForEdit for ${sheetId}, but currently editing ${this.editingSheetId}. Ignoring.`);
            return;
        }
        console.log(`[CustomQuestionsComponent] Populating form for editing sheet: ${name} (${sheetId})`);
        if (this.sheetNameInput) this.sheetNameInput.value = name;
        if (this.questionsTextarea) this.questionsTextarea.value = questionsText;
    }

    /**
     * Handles show view event.
     * @param {object} payload
     * @param {string} payload.viewName
     * @private
     */
    _handleShowView({ viewName }) {
        // Use the registered name from the constant map if available, else use component's this.name
        const registeredName = Object.entries(Views).find(([, val]) => val === this.name)?.[0] ?? this.name;
        if (viewName === Views.CustomQuestions) {
            this.loadAndDisplaySheets();
            this.show();
        } else {
            this.clearInputs();
            this.clearSheetList();
            this.editingSheetId = null;
            this.hide();
        }
    }
} 