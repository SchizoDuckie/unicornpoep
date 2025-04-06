/**
 * Manages the Custom Questions UI for creating, editing, and deleting question sets.
 * Uses class toggling (.hidden) for visibility.
 */
class CustomQuestionsController {
    /**
     * Initializes the controller, gets elements, and sets up listeners.
     * @param {Game} game - The main game instance.
     */
    constructor(mainMenuController) {
        this.mainMenuController = mainMenuController; // Store the hub reference
        this.container = document.getElementById('customQuestionsManager');
        this.sheetNameInput = document.getElementById('customSheetName');
        this.questionsTextarea = document.getElementById('customQuestionsTextarea');
        this.existingSheetsSelect = document.getElementById('existingCustomQuestions');
        this.saveButton = document.getElementById('saveCustomQuestionsButton');
        this.editButton = document.getElementById('editCustomQuestionsButton');
        this.deleteButton = document.getElementById('deleteCustomQuestionsButton');

        this.setupEventListeners();
        this.hide(); // Add .hidden class initially
    }

    /** Sets up listeners for buttons and the select element. */
    setupEventListeners() {
        this.saveButton.addEventListener('click', () => this.handleSave());
        this.editButton.addEventListener('click', () => this.handleEdit());
        this.deleteButton.addEventListener('click', () => this.handleDelete());

        this.existingSheetsSelect.addEventListener('change', () => {
            const selectedSheet = this.existingSheetsSelect.value;
            if (selectedSheet === "") {
                 if (this.sheetNameInput) { this.sheetNameInput.value = ''; this.sheetNameInput.disabled = false; }
                 if (this.questionsTextarea) this.questionsTextarea.value = '';
            } else {
                 this.loadSheetForEditing(selectedSheet);
                 if (this.sheetNameInput) this.sheetNameInput.disabled = true;
            }
        });

        // CORRECTED back button listener (using the stored mainMenuController)
        this.backButton = this.container.querySelector('.backToMain');
        this.backButton.addEventListener('click', () => {
            this.mainMenuController.showView('mainMenu', 'backward'); // Add direction
        });
    }

    /** Shows the custom questions management container and updates dropdown. */
    show() {
        // Assumes #customQuestionsManager base style is display: flex
        this.container.classList.remove('hidden');
        this.updateExistingSheetsDropdown();
        // Reset fields to default "New list" state
        if (this.sheetNameInput) { this.sheetNameInput.value = ''; this.sheetNameInput.disabled = false; }
        if (this.questionsTextarea) this.questionsTextarea.value = '';
        if (this.existingSheetsSelect) this.existingSheetsSelect.value = "";
    }

    /** Hides the custom questions management container. */
    hide() {
        this.container.classList.add('hidden');
    }

    /** Updates the dropdown list of existing custom sheets. */
    updateExistingSheetsDropdown() {
        if (!this.existingSheetsSelect || !this.mainMenuController.questionsManager) return; // Use hub
        try {
            const sheets = this.mainMenuController.questionsManager.listCustomSheets(); // Use hub
            const currentVal = this.existingSheetsSelect.value;
            this.existingSheetsSelect.innerHTML = '<option value="">-- Nieuwe lijst maken --</option>';
            sheets.forEach(sheet => {
                const option = document.createElement('option');
                option.value = sheet; option.textContent = sheet;
                this.existingSheetsSelect.appendChild(option);
            });
            if (sheets.includes(currentVal)) {
                this.existingSheetsSelect.value = currentVal;
            }
        } catch (error) {
            console.error("Error updating custom sheets dropdown:", error);
            this.existingSheetsSelect.innerHTML = '<option value="">Fout bij laden lijsten</option>';
        }
    }

    /** Handles saving new or edited custom questions. */
    handleSave() {
        if (!this.sheetNameInput || !this.questionsTextarea || !this.mainMenuController.questionsManager) return; // Use hub
        const sheetName = this.sheetNameInput.value.trim();
        const customText = this.questionsTextarea.value.trim();

        if (!sheetName) { alert('Geef je vragenlijst een naam.'); return; }
        if (!customText) { alert('Voer tenminste één vraag in (bv. Vraag => Antwoord).'); return; }
        const lines = customText.split('\n');
        const invalidLine = lines.find(line => line.trim() && !line.includes('=>'));
        if (invalidLine) { alert(`Ongeldig formaat op regel: "${invalidLine}". Gebruik 'Vraag => Antwoord'.`); return; }

        try {
            this.mainMenuController.questionsManager.saveCustomQuestions(sheetName, customText); // Use hub
            alert(`Vragenlijst "${sheetName}" opgeslagen!`);
            this.updateExistingSheetsDropdown();
            if (this.existingSheetsSelect) this.existingSheetsSelect.value = sheetName;
            if (this.sheetNameInput) this.sheetNameInput.disabled = true; // Keep disabled

            this.mainMenuController.populateSheetCheckboxes(); // Call directly on mainMenuController if it exists

        } catch (error) {
            console.error("Error saving custom questions:", error);
            alert(`Er ging iets mis bij het opslaan: ${error.message}`);
        }
    }

    /** Handles the "Edit" button click. */
    handleEdit() {
        if (!this.existingSheetsSelect) return;
        const sheetName = this.existingSheetsSelect.value;
        if (!sheetName) {
            alert('Kies eerst een vragenlijst uit de lijst om te bewerken.');
            return;
        }
        this.loadSheetForEditing(sheetName);
    }

    /**
     * Loads content of a selected sheet into the form fields.
     * @param {string} sheetName - The name of the sheet to load.
     */
    loadSheetForEditing(sheetName) {
         if (!this.sheetNameInput || !this.questionsTextarea || !this.mainMenuController.questionsManager) return; // Use hub
         try {
            const questions = this.mainMenuController.questionsManager.getCustomQuestions(sheetName); // Use hub
            if (questions) {
                this.sheetNameInput.value = sheetName;
                this.questionsTextarea.value = this.convertQuestionsToText(questions);
                this.sheetNameInput.disabled = true; // Ensure name is disabled
            } else {
                alert(`Kon vragenlijst "${sheetName}" niet laden.`);
                this.existingSheetsSelect.value = "";
                this.sheetNameInput.value = ''; this.sheetNameInput.disabled = false;
                this.questionsTextarea.value = '';
            }
        } catch (error) {
            console.error("Error loading custom questions for edit:", error);
            alert('Er ging iets mis bij het laden voor bewerken.');
        }
    }

    /** Handles deleting a selected custom sheet. */
    handleDelete() {
        if (!this.existingSheetsSelect || !this.mainMenuController.questionsManager) return; // Use hub
        const sheetName = this.existingSheetsSelect.value;
        if (!sheetName) { alert('Kies eerst een vragenlijst uit de lijst om te verwijderen.'); return; }

        if (confirm(`Weet je zeker dat je de vragenlijst "${sheetName}" permanent wilt verwijderen?`)) {
            try {
                this.mainMenuController.questionsManager.deleteCustomQuestions(sheetName); // Use hub
                alert(`Vragenlijst "${sheetName}" verwijderd.`);
                if (this.sheetNameInput) { this.sheetNameInput.value = ''; this.sheetNameInput.disabled = false; }
                if (this.questionsTextarea) this.questionsTextarea.value = '';
                this.updateExistingSheetsDropdown();

                this.mainMenuController.populateSheetCheckboxes(); // Call directly on mainMenuController

            } catch (error) {
                console.error("Error deleting custom questions:", error);
                alert(`Er ging iets mis bij het verwijderen: ${error.message}`);
            }
        }
    }

    /**
     * Converts question objects back to "Question => Answer" text format.
     * @param {Array<{question: string, answer: string}> | null} questions - Array of question objects.
     * @returns {string} Formatted text block.
     */
    convertQuestionsToText(questions) {
        if (!Array.isArray(questions)) return '';
        return questions.map(q => `${q.question || ''} => ${q.answer || ''}`).join('\n');
    }

    activate() {
        console.log("CustomQuestionsController activating.");
        this.updateExistingSheetsDropdown(); // Load the dropdown when view becomes active
    }
}