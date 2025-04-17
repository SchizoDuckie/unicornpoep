import RefactoredBaseComponent from "./RefactoredBaseComponent.js";
import eventBus from "../core/event-bus.js";
import Events from "../core/event-constants.js";
import questionsManager from "../services/QuestionsManager.js";
import Views from "../core/view-constants.js";
import uiManager from '../ui/UIManager.js';
import { getTextTemplate } from "../utils/miscUtils.js";

/**
 * Class CustomQuestionsComponent.
 * 
 * Component for managing custom question sheets including creation, editing, 
 * displaying and deletion of user-defined question sets.
 * 
 * @property string|null $editingSheetId ID of the sheet currently being edited
 * @property HTMLInputElement $sheetNameInput Input field for the sheet name
 * @property HTMLTextAreaElement $questionsTextarea Textarea for question content
 * @property HTMLElement $customSheetListContainer Container for the list of custom sheets
 * @property HTMLTemplateElement $sheetItemTemplate Template for sheet list items
 */
export default class CustomQuestionsComponent extends RefactoredBaseComponent {
    static SELECTOR = '#customQuestionsManager';
    static VIEW_NAME = 'CustomQuestionsComponent';

    editingSheetId = null;

    /**
     * Initialize component event listeners and DOM bindings.
     * 
     * @return Object Configuration object for the component
     */
    initialize() {
        return {
            events: [
                { eventName: Events.Menu.CustomQuestions.SaveSuccess, callback: this._handleSaveSuccess },
                { eventName: Events.Menu.CustomQuestions.DeleteSuccess, callback: this._handleDeleteSuccess },
                { eventName: Events.Menu.CustomQuestions.SheetLoadedForEdit, callback: this._populateFormForEdit },
                { eventName: Events.Navigation.ShowView, callback: this._handleShowView },
                { eventName: Events.UI.CustomQuestions.SheetActionClicked, callback: this._handleSheetAction }
            ],
            domEvents: [
                { selector: "#saveCustomQuestionsButton", event: "click", handler: this._handleSaveClick },
                { 
                    selector: ".backToMain", 
                    event: "click", 
                    emits: Events.Navigation.ShowView, 
                    payload: { viewName: Views.MainMenu }
                },
                { 
                    selector: ".sheet-action-button", 
                    event: "click", 
                    emits: Events.UI.CustomQuestions.SheetActionClicked,
                    includeTarget: true
                },
                { selector: "#customSheetList", event: "click", handler: this._handleListClick }
            ],
            domElements: [
                { name: "sheetNameInput", selector: "#customSheetName" },
                { name: "questionsTextarea", selector: "#customQuestionsTextarea" },
                { name: "customSheetListContainer", selector: "#customSheetList" },
                { name: "sheetItemTemplate", selector: "#custom-sheet-item-template" }
            ]
        };
    }

    /**
     * Handle clicks on the custom sheet list.
     * 
     * @param MouseEvent $event The click event
     * @return void
     */
    _handleListClick(event) {
        const targetButton = event.target.closest("button");
        if (!targetButton) return;

        const sheetId = targetButton.dataset.sheetId;
        if (!sheetId) return;

        const listItem = targetButton.closest('.custom-sheet-item');
        const sheetName = listItem.querySelector('.sheet-name').textContent || sheetId || getTextTemplate('customQDeleteFallbackName');

        if (targetButton.classList.contains("delete-button")) {
            this._handleDeleteClick(sheetId, sheetName);
        } else if (targetButton.classList.contains("edit-button")) {
            this._handleEditClick(sheetId);
        }
    }

    /**
     * Handle save button click.
     * Validates input fields and emits save event.
     * 
     * @return void
     */
    _handleSaveClick() {
        const nameInput = this.elements.sheetNameInput;
        const textarea = this.elements.questionsTextarea;
        
        if (!nameInput || !textarea) {
           debugger;
        }
        
        const sheetName = nameInput.value.trim();
        const questionsText = textarea.value.trim();

        if (!sheetName) {
            eventBus.emit(Events.System.ShowFeedback, { 
                message: getTextTemplate('customQWarnName'), 
                level: "warn" 
            });
            nameInput.focus();
            return;
        }
        
        if (!questionsText) {
            eventBus.emit(Events.System.ShowFeedback, {
                message: getTextTemplate('customQWarnQuestion'),
                level: "warn"
            });
            textarea.focus();
            return;
        }

        eventBus.emit(Events.UI.CustomQuestions.SaveClicked, {
            name: sheetName,
            questionsText,
            sheetId: this.editingSheetId
        });

        this.clearInputs();
    }

    /**
     * Handle successful sheet save.
     * 
     * @param Object $data Save success data
     * @param string $data.sheetId ID of the saved sheet
     * @param string $data.name Name of the saved sheet
     * @return void
     */
    _handleSaveSuccess({ sheetId, name }) {
        this.loadAndDisplaySheets();
    }

    /**
     * Clear all input fields and reset editing state.
     * 
     * @return void
     */
    clearInputs() {
        const nameInput = this.elements.sheetNameInput;
        if (nameInput) {
            nameInput.value = "";
        }
        
        const textarea = this.elements.questionsTextarea;
        if (textarea) {
            textarea.value = "";
        }
        
        this.editingSheetId = null;
    }

    /**
     * Clear the sheet list container.
     * 
     * @return void
     */
    clearSheetList() {
        const container = this.elements.customSheetListContainer;
        if (container) {
            container.innerHTML = "";
        }
    }

    /**
     * Load and display all custom question sheets.
     * Creates list items for each custom sheet.
     * 
     * @return void
     */
    loadAndDisplaySheets() {
        this.clearSheetList();
        
        const container = this.elements.customSheetListContainer;
        if (!container) {
            console.error(`[${this.name}] Cannot load sheets: sheet list container not available`);
            return;
        }

        try {
            const allSheets = questionsManager.getAvailableSheets();
            const customSheets = allSheets.filter(sheet => sheet.isCustom);

            if (customSheets.length === 0) {
                container.innerHTML = `<p><i>${getTextTemplate('customQListEmpty')}</i></p>`;
                return;
            }

            const listFragment = document.createDocumentFragment();
            const templateElement = this.elements.sheetItemTemplate;
            
            if (!templateElement) {
                console.error(`[${this.name}] Cannot load sheets: sheet item template not available`);
                return;
            }

            customSheets.forEach(sheet => {
                const templateClone = templateElement.content.cloneNode(true);
                const listItem = templateClone.querySelector(".custom-sheet-item");
                
                if (!listItem) return;

                listItem.dataset.sheetId = sheet.id;

                const nameSpan = listItem.querySelector(".sheet-name");
                if (nameSpan) nameSpan.textContent = sheet.name;

                const editButton = listItem.querySelector(".edit-button");
                if (editButton) {
                    editButton.dataset.sheetId = sheet.id;
                    editButton.disabled = true;
                }

                const deleteButton = listItem.querySelector(".delete-button");
                if (deleteButton) {
                    deleteButton.dataset.sheetId = sheet.id;
                    deleteButton.disabled = false;
                }

                listFragment.appendChild(templateClone);
            });

            container.appendChild(listFragment);
        } catch (error) {
            container.innerHTML = `<p><i>${getTextTemplate('customQListError')}</i></p>`;
            eventBus.emit(Events.System.ShowFeedback, {
                message: getTextTemplate('customQLoadError'),
                level: "error"
            });
        }
    }

    /**
     * Handle delete button click.
     * Shows confirmation dialog before deletion.
     * 
     * @param string $sheetId ID of the sheet to delete
     * @param string $sheetName Name of the sheet to delete
     * @return void
     */
    _handleDeleteClick(sheetId, sheetName) {
        const confirmationDialog = uiManager.components.get('ConfirmationDialog');
        if (!confirmationDialog) {
            eventBus.emit(Events.System.ShowFeedback, {
                message: "Kon verwijdering niet starten.",
                level: "error"
            });
            return;
        }

        confirmationDialog.show({
            title: "Lijst Verwijderen?",
            message: `Weet je zeker dat je de lijst '${sheetName}' wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`,
            okText: "Verwijder",
            cancelText: "Annuleren",
            context: { sheetId, sheetName },
            onConfirm: (context) => {
                eventBus.emit(Events.UI.CustomQuestions.DeleteClicked, { 
                    sheetId: context.sheetId 
                });
            }
        });
    }

    /**
     * Handle successful sheet deletion.
     * 
     * @return void
     */
    _handleDeleteSuccess() {
        this.loadAndDisplaySheets();
    }

    /**
     * Handle edit button click.
     * Requests sheet data for editing.
     * 
     * @param string $sheetId ID of the sheet to edit
     * @return void
     */
    _handleEditClick(sheetId) {
        this.editingSheetId = sheetId;
        eventBus.emit(Events.UI.CustomQuestions.EditClicked, { sheetId });
        
        const nameInput = this.elements.sheetNameInput;
        if (nameInput) {
            nameInput.focus();
        }
    }

    /**
     * Populate the form with sheet data for editing.
     * 
     * @param Object $data Sheet data
     * @param string $data.sheetId ID of the sheet
     * @param string $data.name Name of the sheet
     * @param string $data.questionsText Questions text content
     * @return void
     */
    _populateFormForEdit({ sheetId, name, questionsText }) {
        if (sheetId !== this.editingSheetId) return;
        
        const nameInput = this.elements.sheetNameInput;
        const textarea = this.elements.questionsTextarea;
        
        if (nameInput) {
            nameInput.value = name;
        }
        
        if (textarea) {
            textarea.value = questionsText;
        }
        
        this.editingSheetId = sheetId;
    }

    /**
     * Handle navigation to this view.
     * 
     * @param Object $data Navigation data
     * @param string $data.viewName Name of the view to show
     * @return void
     */
    _handleShowView({ viewName }) {
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

    /**
     * Example handler for SheetActionClicked event with includeTarget.
     * Shows how to access data attributes from the included target element.
     * 
     * @param Object $data Event payload containing the target element
     * @param HTMLElement $data.target The DOM element that was clicked
     * @return void
     */
    _handleSheetAction({ target }) {
        if (!target || !target.dataset) return;
        
        const action = target.dataset.action;
        const sheetId = target.dataset.sheetId;
        
        console.log(`[${this.name}] Sheet action '${action}' clicked for sheet ID: ${sheetId}`);
        
        // Based on the action in data-action attribute, perform different operations
        switch (action) {
            case 'edit':
                this._handleEditClick(sheetId);
                break;
            case 'delete':
                const sheetName = target.closest('.sheet-item').querySelector('.sheet-name').textContent || sheetId;
                this._handleDeleteClick(sheetId, sheetName);
                break;
            // Other actions can be added here
        }
    }
} 