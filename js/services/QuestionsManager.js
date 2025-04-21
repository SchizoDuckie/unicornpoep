import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import uiManager from '../ui/UIManager.js'; // Import UIManager to access dialogs
import { getTextTemplate } from '../utils/miscUtils.js'; // Import the new utility

// Configuration and constants
const CONFIG_PATH = './config.json'; // Path to the config file relative to index.html
const DEFAULT_SHEET_DIR = './'; // Base directory for default sheets
const CUSTOM_SHEETS_STORAGE_KEY = 'customSheets';

/**
 * Manages loading and accessing question sheet data.
 * Handles fetching default sheets (discovered via config.json) and custom sheets (localStorage).
 */
class QuestionsManager {
    constructor() {
        this.customSheets = new Map(); // Stores { id, name, questions: [{ question, answer }], isCustom: true, originHostName?: string }
        this.loadedQuestionsCache = new Map(); // Caches parsed CATEGORY OBJECTS keyed by FILE ID (e.g., 'tafels')
        this.selectableItems = []; // Holds { id: string, name: string, isCustom: boolean } for UI
        this.isInitialized = false;
        this.initializationPromise = null;
        this.initialize();
        this._registerEventListeners();
    }

    /**
     * Registers event listeners for UI actions related to custom questions.
     * @private
     */
    _registerEventListeners() {
        eventBus.on(Events.UI.CustomQuestions.SaveClicked, this._handleSaveCustomSheet);
        eventBus.on(Events.UI.CustomQuestions.DeleteClicked, this._handleDeleteCustomSheet);
        eventBus.on(Events.UI.CustomQuestions.EditClicked, this._handleLoadSheetForEdit);
    }

    /**
     * Initializes the QuestionsManager by discovering default sheets from config.json
     * and loading custom sheets from localStorage.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     */
    async initialize() {
        if (this.initializationPromise) return this.initializationPromise;

        this.initializationPromise = (async () => {
            this.selectableItems = []; // Reset selectable items list
            try {
                // Discover default sheets AND PARSE CATEGORIES
                await this._discoverAndParseDefaultSheets();

                // Load custom sheets and add them to selectable items
                this._loadCustomSheetsAndAddToSelectable();

                this.isInitialized = true;
                console.log(`[QuestionsManager] Initialization complete. ${this.selectableItems.length} selectable items available.`);

            } catch (error) {
                console.error("[QuestionsManager] Critical initialization error:", error);
                this.isInitialized = false;
                this.selectableItems = []; // Clear list on error
                throw error;
            }
        })();

        return this.initializationPromise;
    }

    /** Ensures initialization is complete before proceeding. */
    async _ensureInitialized() {
        if (!this.initializationPromise) {
            this.initialize();
        }
        return this.initializationPromise;
    }

    /**
     * Fetches and parses the config.json file.
     * @returns {Promise<object>} The parsed configuration object.
     * @throws {Error} If fetching or parsing fails.
     * @private
     */
    async _loadConfig() {
        console.debug(`[QuestionsManager] Fetching config from ${CONFIG_PATH}...`);
        try {
            const response = await fetch(CONFIG_PATH);
            if (!response.ok) {
                throw new Error(`HTTP error fetching config! Status: ${response.status}`);
            }
            const config = await response.json();
            console.debug("[QuestionsManager] Config loaded successfully:", config);
            return config;
        } catch (error) {
            console.error(`[QuestionsManager] Failed to load or parse config from ${CONFIG_PATH}:`, error);
            throw error;
        }
    }

    /**
     * Loads config, fetches default sheets, parses them for categories,
     * caches the full parsed data, and builds the selectable item list for categories.
     * @private
     */
    async _discoverAndParseDefaultSheets() {
        console.log(`[QuestionsManager] Discovering and parsing default sheets from ${CONFIG_PATH}...`);
        let discoveredCount = 0;
        try {
            const config = await this._loadConfig();
            if (!config || !Array.isArray(config.sheets)) {
                console.error("[QuestionsManager] Invalid or missing config.json structure.");
                return; // Stop discovery
            }

            const loadPromises = config.sheets.map(async (sheetFilename) => {
                if (typeof sheetFilename !== 'string' || !sheetFilename.endsWith('.txt')) {
                    console.warn(`[QuestionsManager] Skipping invalid sheet entry in config: ${sheetFilename}`);
                    return; // Skip this file
                }
                const fileId = sheetFilename.replace('.txt', '');
                const path = `${DEFAULT_SHEET_DIR}${sheetFilename}`;

                try {
                    // console.debug(`[QuestionsManager] Fetching ${path}...`);
                    const response = await fetch(path);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status} for ${path}`);
                    }
                    const sheetText = await response.text();
                    // Parse into category object { "Cat Name": [...] }
                    const parsedCategoryObject = this._parseSheetText(sheetText, fileId);

                    // Cache the full parsed object keyed by fileId
                    if (Object.keys(parsedCategoryObject).length > 0) {
                        this.loadedQuestionsCache.set(fileId, parsedCategoryObject);
                        // console.debug(`[QuestionsManager] Cached category object for file: ${fileId}`);

                        // Add each category title to selectableItems
                        Object.keys(parsedCategoryObject).forEach(categoryTitle => {
                            this.selectableItems.push({
                                id: `${fileId}:${categoryTitle}`, // Composite ID
                                name: categoryTitle,
                                isCustom: false
                            });
                            discoveredCount++;
                            // console.debug(`[QuestionsManager] Added selectable category: ${categoryTitle} (ID: ${fileId}:${categoryTitle})`);
                        });
                    } else {
                         console.warn(`[QuestionsManager] No categories/questions parsed from ${sheetFilename}, skipping.`);
                    }
                } catch (loadError) {
                    console.error(`[QuestionsManager] Failed to load/parse sheet ${sheetFilename}:`, loadError);
                    // Do not add to selectableItems if load/parse fails
                }
            });

            await Promise.allSettled(loadPromises); // Wait for all files to be processed
            console.log(`[QuestionsManager] Discovered and parsed ${discoveredCount} categories from default sheets.`);

        } catch (error) {
            console.error("[QuestionsManager] Error during default sheet discovery:", error);
            // Continue initialization if possible? Or re-throw?
        }
    }

    /** Loads custom sheets and adds their metadata to the selectableItems list. */
    _loadCustomSheetsAndAddToSelectable() {
        console.log("[QuestionsManager] Loading custom sheets from localStorage...");
        // Load data first (uses CUSTOM_SHEETS_STORAGE_KEY = 'customSheets')
        this._loadCustomSheets(); // This populates this.customSheets Map

        // Now add them to the selectable list
        this.customSheets.forEach((sheetData, sheetId) => {
            this.selectableItems.push({
                id: sheetId, // Use the custom sheet's unique ID
                name: sheetData.name || getTextTemplate('qmDefaultCustomName'),
                isCustom: true
            });
        });
         console.log(`[QuestionsManager] Added ${this.customSheets.size} custom sheets to selectable items.`);
    }

    /** Loads custom sheets from localStorage. */
    _loadCustomSheets() {
        console.log("[QuestionsManager] Loading custom sheets from localStorage...");
        try {
            const storedData = localStorage.getItem(CUSTOM_SHEETS_STORAGE_KEY);
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                // V2: Expecting format { sheetId: { id, name, questions, isCustom, originHostName? } }
                if (typeof parsedData === 'object' && parsedData !== null) {
                    // Directly create Map from entries, assuming stored data has correct format
                    this.customSheets = new Map(Object.entries(parsedData)); 
                    console.log(`[QuestionsManager] Loaded ${this.customSheets.size} custom sheets data.`);
                } else {
                    console.warn("[QuestionsManager] Invalid data format found in localStorage for custom sheets. Starting fresh.");
                    this.customSheets = new Map();
                    localStorage.removeItem(CUSTOM_SHEETS_STORAGE_KEY);
                }
            } else {
                // console.log("[QuestionsManager] No custom sheets found in localStorage.");
                this.customSheets = new Map();
            }
        } catch (error) {
            console.error("[QuestionsManager] Error loading custom sheets from localStorage:", error);
            this.customSheets = new Map();
        }
    }

    /** Saves the current custom sheets map to localStorage. */
    _saveCustomSheets() {
        try {
            // Convert Map to object for JSON serialization
            const objectToStore = Object.fromEntries(this.customSheets);
            localStorage.setItem(CUSTOM_SHEETS_STORAGE_KEY, JSON.stringify(objectToStore));
            console.debug("[QuestionsManager] Custom sheets saved to localStorage.");
        } catch (error) {
            console.error("[QuestionsManager] Error saving custom sheets to localStorage:", error);
            eventBus.emit(Events.System.ErrorOccurred, { message: getTextTemplate('qmSaveError'), error });
        }
    }

    /**
     * Parses text content with categories into a structured object.
     * Mimics V1 parsing logic.
     * @param {string} text - The raw text content with categories separated by double newlines.
     * @param {string} sheetIdForLogging - The sheet ID for error messages.
     * @returns {Object.<string, Array<{question: string, answer: string}>>} Object mapping category title to question array.
     * @throws {Error} If parsing fails on any line.
     * @private
     */
    _parseSheetText(text, sheetIdForLogging) {
        // V1 Parsing Logic
        const categories = text.replace(/\r/g, '').trim().split('\n\n');
        const questionsData = {};
        let firstErrorLine = -1;
        let firstErrorMessage = null;

        categories.forEach((categoryBlock, catIndex) => {
            if (firstErrorMessage) return; // Stop if error found

            const lines = categoryBlock.split('\n');
            if (lines.length === 0) return; // Skip empty blocks

            const titleLine = lines.shift();
            // Handle potential parsing issue if title line is missing or empty
            if (!titleLine) {
                 console.warn(`[QuestionsManager] Empty block or missing title in sheet '${sheetIdForLogging}', category index ${catIndex}. Skipping.`);
                 return;
            }
            const title = titleLine.trim().replace(/:$/, '').trim(); // Remove trailing colon if present
             if (!title) {
                 console.warn(`[QuestionsManager] Invalid empty title found in sheet '${sheetIdForLogging}', category index ${catIndex}. Skipping category.`);
                 return; // Skip category with empty title
            }

            questionsData[title] = []; // Initialize category array

            lines.forEach((line, lineIndex) => {
                if (firstErrorMessage) return; // Stop if error found

                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('//')) return; // Skip empty lines or comments

                const separatorIndex = trimmedLine.indexOf('=>');
                if (separatorIndex === -1 || separatorIndex === 0 || separatorIndex === trimmedLine.length - 2) {
                    // Capture error details
                    firstErrorLine = lineIndex + 1; // User-facing line number
                    // Use template for parse error, substitute line and content
                    firstErrorMessage = getTextTemplate('qmParseErrorLine', {
                        '%LINE%': firstErrorLine,
                        '%CONTENT%': trimmedLine.substring(0, 50) // Limit content length
                    });
                    return; // Stop processing lines in this category
                }

                const question = trimmedLine.substring(0, separatorIndex).trim();
                const answer = trimmedLine.substring(separatorIndex + 2).trim();
                if (question && answer) {
                    questionsData[title].push({ question, answer });
                } else {
                    // Calculate approximate original line number
                    let cumulativeLine = 1; // Start with title line
                    for(let i = 0; i < catIndex; i++) {
                       cumulativeLine += categories[i].split('\n').length + 1; // lines + newline separator
                    }
                    cumulativeLine += lineIndex + 1; // 0-based line index within category + title line offset

                    firstErrorLine = cumulativeLine
                    firstErrorMessage = `Ongeldig formaat op regel ~${firstErrorLine} in sheet '${sheetIdForLogging}' (Categorie: '${title}'): Lege vraag of antwoord.`;
                }
            });
             // Remove category if it ended up empty (e.g., only contained comments)
             if (questionsData[title].length === 0) {
                 delete questionsData[title];
             }
        });

        if (firstErrorMessage) {
            console.error(`[QuestionsManager] Parsing error: ${firstErrorMessage}`);
            throw new Error(firstErrorMessage);
        }

        if (Object.keys(questionsData).length === 0 && categories.length > 0 && categories[0].trim() !== '') {
            console.warn(`[QuestionsManager] No valid categories or questions found after parsing sheet '${sheetIdForLogging}'. Check format.`);
        }

        return questionsData; // Return the category object
    }

    // --- Custom Sheet Management ---

    /**
     * Saves a custom question sheet, either creating a new one or updating existing.
     * Parses raw text input.
     * @param {string} providedSheetId - The unique ID for the sheet.
     * @param {string} name - The name of the sheet.
     * @param {string} questionsText - The raw text containing questions and answers.
     * @returns {Promise<string>} The ID of the saved sheet (new or existing).
     * @throws {Error} If saving fails.
     */
    async saveCustomSheetFromText(providedSheetId, name, questionsText) {
        await this._ensureInitialized();
        
        const isEditing = !!providedSheetId;
        const sheetId = isEditing ? providedSheetId : `custom_${Date.now()}`;
        console.log(`[QuestionsManager] Attempting to save custom sheet: ${name} (ID: ${sheetId}, Editing: ${isEditing})`);

        // Validate name and text
        if (!name || typeof questionsText !== 'string') {
            throw new Error("[QuestionsManager] Invalid arguments: Missing name or questionsText.");
        }

        try {
            const questions = this._parseCustomQuestionsText(questionsText);
            if (questions.length === 0) {
                throw new Error("Geen geldige vragen gevonden om op te slaan.");
            }

            const newSheetData = {
                id: sheetId, // Ensure ID is stored within the sheet data itself
                name: name,
                questions: questions,
                isCustom: true
            };

            this.customSheets.set(sheetId, newSheetData);
            this._saveCustomSheets(); // Persist to localStorage
            this._updateSelectableItems(); // Update the internal list for getAvailableSheets

            console.log(`[QuestionsManager] Custom sheet '${name}' saved successfully.`);
            return sheetId; // Return the ID used for saving

        } catch (error) {
            console.error(`[QuestionsManager] Error saving custom sheet '${name}':`, error);
            throw error; // Re-throw the error to be caught by the handler
        }
    }

    /**
     * Parses the raw text from the custom questions textarea.
     * Each line should be "Question => Answer".
     * @param {string} text - The raw text from the textarea.
     * @returns {Array<{question: string, answer: string}>} Parsed question objects.
     * @throws {Error} If any line has an invalid format.
     * @private
     */
    _parseCustomQuestionsText(text) {
        const lines = text.replace(/\r/g, '').split('\n');
        const questions = [];
        const errors = [];

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('//')) return; // Skip empty/comment lines

            const parts = trimmedLine.split('=>');
            if (parts.length === 2) {
                const question = parts[0].trim();
                const answer = parts[1].trim();
                if (question && answer) {
                    questions.push({ question, answer });
                } else {
                    errors.push(`Regel ${index + 1}: Vraag of antwoord is leeg.`);
                }
            } else {
                errors.push(`Regel ${index + 1}: Ongeldig formaat (gebruik "Vraag => Antwoord").`);
            }
        });

        if (errors.length > 0) {
            throw new Error(`Fouten in vragenlijst:\n${errors.join('\n')}`);
        }

        return questions;
    }

    /**
     * Formats an array of question objects back into text for the textarea.
     * @param {Array<{question: string, answer: string}>} questions
     * @returns {string}
     */
    formatQuestionsForTextarea(questions) {
        if (!Array.isArray(questions)) return '';
        return questions.map(q => `${q.question} => ${q.answer}`).join('\n');
    }

    /**
     * Deletes a custom question sheet.
     * Needs confirmation before deleting.
     * @param {string} sheetId - The ID of the sheet to delete.
     * @returns {boolean} True if deletion was successful (after confirmation), false otherwise.
     */
    deleteCustomSheet(sheetId) {
        const sheetToDelete = this.customSheets.get(sheetId);
        if (!sheetToDelete) {
            console.warn(`[QuestionsManager] Cannot delete sheet ${sheetId}: Not found.`);
            return false;
        }

        // *** Replace confirm() with ConfirmationDialog ***
        const confirmationDialog = uiManager.components.get('ConfirmationDialog');
        if (!confirmationDialog) {
             console.error("[QuestionsManager] ConfirmationDialog component not found in UIManager!");
             // Use the template for the error message
             eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('deleteSheetError'), level: "error" });
             return false;
        }

        const sheetName = sheetToDelete.name || sheetId; // Get the name for the message

        confirmationDialog.show({
            title: getTextTemplate('deleteSheetTitle'), // Get text from template
            message: getTextTemplate('deleteSheetMessage', { '%NAME%': sheetName }), // Get text and substitute %NAME%
            okText: getTextTemplate('deleteSheetOk'), // Get text from template
            cancelText: getTextTemplate('deleteSheetCancel'), // Get text from template
            context: sheetId, // Pass sheetId as context
            onConfirm: (contextSheetId) => {
                console.log(`[QuestionsManager] Confirmed deletion for: ${contextSheetId}`);
                if (this.customSheets.delete(contextSheetId)) {
                    this._saveCustomSheets();
                    this._updateSelectableItems();
                    console.log(`[QuestionsManager] Custom sheet ${contextSheetId} deleted.`);
                    // Let the coordinator emit success events
                } else {
                     console.error(`[QuestionsManager] Failed to delete sheet ${contextSheetId} from map after confirmation.`);
                     // Let the coordinator emit failure events
                }
            },
            onCancel: (contextSheetId) => {
                console.log(`[QuestionsManager] Cancelled deletion for: ${contextSheetId}`);
                 // Let the coordinator know deletion was cancelled if needed
            }
        });

        // Return false immediately because the actual deletion happens asynchronously after confirmation
        // The coordinator should handle success/failure based on events from the dialog/callback
        return false; 
    }

    // --- Getting Sheets ---

    /**
     * Returns the combined list of selectable items (categories from default sheets + custom sheets).
     * @returns {Array<{id: string, name: string, isCustom: boolean}>}
     */
    getAvailableSheets() {
        if (!this.isInitialized) {
            console.warn("[QuestionsManager] getAvailableSheets called before initialization complete. Results may be incomplete.");
        }
        // Return a copy to prevent external modification
        return [...this.selectableItems];
    }

    /**
     * Retrieves a flat array of questions for a given selectable item ID.
     * Handles custom sheets ID or composite IDs ('fileId:Category Title') for default sheets.
     * @param {string} selectableId - The ID from the selectableItems list.
     * @returns {Promise<Array<{question: string, answer: string}>>} A promise resolving to the questions array.
     * @throws {Error} If the ID is invalid or questions cannot be retrieved.
     */
    async getQuestionsForSheet(selectableId) {
        await this._ensureInitialized();

        console.debug(`[QuestionsManager] getQuestionsForSheet requested for selectable ID: ${selectableId}`);

        // 1. Check if it's a known custom sheet ID
        if (this.customSheets.has(selectableId)) {
            console.debug(`[QuestionsManager] Returning questions from custom sheet: ${selectableId}`);
            const customSheetData = this.customSheets.get(selectableId);
            return customSheetData.questions || [];
        }

        // 2. Try to parse as composite ID 'fileId:Category Title'
        const parts = selectableId.split(':');
        if (parts.length >= 2) { // Allow for ':' within category title itself
            const fileId = parts[0];
            const categoryTitle = parts.slice(1).join(':'); // Re-join if title had colons

            // Check cache for the parsed file object
            if (this.loadedQuestionsCache.has(fileId)) {
                const categoryObject = this.loadedQuestionsCache.get(fileId);
                // Check if the specific category exists within the cached object
                if (categoryObject && typeof categoryObject === 'object' && categoryObject.hasOwnProperty(categoryTitle)) {
                    console.debug(`[QuestionsManager] Returning questions for category '${categoryTitle}' from file '${fileId}'`);
                    return categoryObject[categoryTitle] || []; // Return the array for that category
                } else {
                    console.error(`[QuestionsManager] Category '${categoryTitle}' not found within cached data for file '${fileId}'.`);
                    throw new Error(getTextTemplate('qmGetErrorCategoryNotFound', {
                        '%CATEGORY%': categoryTitle,
                        '%FILE%': fileId
                    }));
                }
            } else {
                // This means the file wasn't loaded/cached during init, which is an error
                console.error(`[QuestionsManager] File data for '${fileId}' not found in cache for selectable ID: ${selectableId}. Initialization incomplete?`);
                throw new Error(getTextTemplate('qmGetErrorBaseData', { '%FILE%': fileId }));
            }
        } else {
             // 3. ID is not custom and not a valid composite ID format
             console.error(`[QuestionsManager] Invalid selectable ID format or sheet not found: ${selectableId}`);
             throw new Error(getTextTemplate('qmGetErrorInvalidId', { '%ID%': selectableId }));
        }
    }

    /**
     * Retrieves the actual question data for a list of selectable sheet IDs.
     * Handles both default (composite ID) and custom sheets.
     * Ensures initialization is complete before proceeding.
     *
     * @param {string[]} selectableIds - An array of sheet IDs (e.g., ["tafels:Tafel van 2", "custom_123"]).
     * @returns {Promise<object>} A promise resolving to an object { sheets: Array<{ id: string, name: string, isCustom: boolean, questions: Array<{question: string, answer: string}> }> }.
     * @throws {Error} If initialization fails or a sheet ID is invalid.
     */
    async getQuestionsForSheets(selectableIds) {
        await this._ensureInitialized();
        console.log(`[QuestionsManager] Getting combined questions for IDs:`, selectableIds);

        const results = {
            sheets: []
        };

        if (!Array.isArray(selectableIds) || selectableIds.length === 0) {
            console.warn("[QuestionsManager] getQuestionsForSheets called with empty or invalid IDs array.");
            return results; // Return empty structure
        }

        for (const id of selectableIds) {
            try {
                const sheetInfo = this.selectableItems.find(item => item.id === id);
                if (!sheetInfo) {
                    console.warn(`[QuestionsManager] Selectable item not found for ID: ${id}. Skipping.`);
                    continue;
                }

                let questions = [];
                if (sheetInfo.isCustom) {
                    // Custom sheet
                    const customSheetData = this.customSheets.get(id);
                    if (customSheetData && Array.isArray(customSheetData.questions)) {
                        questions = customSheetData.questions;
                    } else {
                        console.warn(`[QuestionsManager] Custom sheet data missing or invalid for ID: ${id}. Skipping.`);
                        continue;
                    }
                } else {
                    // Default sheet (composite ID: fileId:categoryTitle)
                    const parts = id.split(':');
                    if (parts.length < 2) { // Allow for titles containing colons
                         console.warn(`[QuestionsManager] Invalid default sheet ID format: ${id}. Skipping.`);
                         continue;
                    }
                    const fileId = parts[0];
                    const categoryTitle = parts.slice(1).join(':'); // Re-join title if it contained colons

                    const cachedCategoryObject = this.loadedQuestionsCache.get(fileId);
                    if (cachedCategoryObject && cachedCategoryObject[categoryTitle] && Array.isArray(cachedCategoryObject[categoryTitle])) {
                        questions = cachedCategoryObject[categoryTitle];
                    } else {
                        console.warn(`[QuestionsManager] Default category questions not found in cache for ID: ${id} (File: ${fileId}, Category: ${categoryTitle}). Skipping.`);
                        continue;
                    }
                }
                
                 // Ensure questions have the correct format
                 const formattedQuestions = questions.map(q => ({
                     question: q.question || '',
                     answer: q.answer || '' 
                 }));

                results.sheets.push({
                    id: id,
                    name: sheetInfo.name, // Use the name from selectableItems
                    isCustom: sheetInfo.isCustom,
                    questions: formattedQuestions
                });

            } catch (error) {
                console.error(`[QuestionsManager] Error processing sheet ID ${id}:`, error);
                // Optionally re-throw or just log and continue with other sheets
            }
        }

        console.log(`[QuestionsManager] Successfully retrieved data for ${results.sheets.length} sheets.`);
        return results;
    }

    /**
     * Gets a display-friendly name for a given sheet ID.
     * Placeholder implementation - adjust based on how sheet data is stored.
     * @param {string} sheetId - The ID of the sheet (e.g., 'default_1', 'custom_abc').
     * @returns {string|null} The display name or null if not found.
     */
    getSheetDisplayName(sheetId) {
        // Defensive: ensure selectableItems is an array
        if (!Array.isArray(this.selectableItems)) {
            console.warn('[QuestionsManager] selectableItems is not an array in getSheetDisplayName:', this.selectableItems);
            return 'Unknown';
        }
        const item = this.selectableItems.find(item => item.id === sheetId);
        return item ? item.name : 'Unknown';
    }

    /** Refreshes the `selectableItems` array based on current default and custom sheets. */
    _updateSelectableItems() {
        console.debug("[QuestionsManager] Refreshing selectable items list.");
        this.selectableItems = [];
        // Add default categories from cache
        this.loadedQuestionsCache.forEach((categoryObject, fileId) => {
            Object.keys(categoryObject).forEach(categoryTitle => {
                this.selectableItems.push({
                    id: `${fileId}:${categoryTitle}`, // Composite ID
                    name: categoryTitle,
                    isCustom: false
                });
            });
        });
        // Add custom sheets
        this.customSheets.forEach((sheetData, sheetId) => {
            this.selectableItems.push({
                id: sheetId,
                name: sheetData.name || getTextTemplate('qmDefaultCustomName'),
                isCustom: true
            });
        });
        console.debug(`[QuestionsManager] Selectable items refreshed. Count: ${this.selectableItems.length}`);
    }

    /**
     * Safely adds a custom sheet received from a host.
     * Prevents overwriting existing sheets with the same ID.
     * @param {object} sheetData - The sheet data object { id, name, isCustom, questions }.
     * @param {string} originHostName - The name of the host the sheet came from.
     */
    addReceivedCustomSheet(sheetData, originHostName) {
        if (!sheetData || !sheetData.id || !sheetData.name || !Array.isArray(sheetData.questions) || !sheetData.isCustom) {
            console.warn("[QuestionsManager] Attempted to add invalid received custom sheet data:", sheetData);
            return; // Invalid data
        }

        if (this.customSheets.has(sheetData.id)) {
            console.log(`[QuestionsManager] Custom sheet with ID ${sheetData.id} already exists locally. Skipping save.`);
            // Optional: Emit feedback event?
            // eventBus.emit(Events.System.ShowFeedback, { message: `Lijst '${sheetData.name}' bestaat al lokaal.`, level: 'info' });
            return; // Do not overwrite existing sheet
        }

        // Add origin host name to the data before saving
        const dataToSave = {
            ...sheetData,
            originHostName: originHostName || 'Unknown Host' // Store host name
        };

        this.customSheets.set(sheetData.id, dataToSave);
        this._saveCustomSheets(); // Persist to localStorage
        this._updateSelectableItems(); // Update the internal list for UI

        console.log(`[QuestionsManager] Saved received custom sheet '${sheetData.name}' (ID: ${sheetData.id}) from host '${originHostName}'.`);
        eventBus.emit(Events.System.ShowFeedback, { message: `Nieuwe lijst '${sheetData.name}' ontvangen en opgeslagen.`, level: 'success' });
    }

    // --- Event Handlers --- 

    /**
     * Handles the SaveClicked event from the UI.
     * Calls the appropriate save logic.
     * @param {object} payload - The event payload.
     * @param {string} payload.name - The name of the sheet.
     * @param {string} payload.questionsText - The raw text of questions (old format).
     * @param {string|null} payload.sheetId - The ID of the sheet if editing, null if new.
     * @private
     */
    _handleSaveCustomSheet = async ({ name, questionsText, sheetId }) => {
        console.log(`[QuestionsManager] Handling SaveClicked event. Sheet ID: ${sheetId}, Name: ${name}`);
        try {
            // Pass the potentially null sheetId from the event
            const actualSheetId = await this.saveCustomSheetFromText(sheetId, name, questionsText);
            // Get the name from the actually saved sheet data
            const savedSheetData = this.customSheets.get(actualSheetId);
            const savedName = savedSheetData?.name || name; // Fallback to original name if needed
            console.log(`[QuestionsManager] Save successful. Emitting SaveSuccess. ID: ${actualSheetId}, Name: ${savedName}`);
            eventBus.emit(Events.Menu.CustomQuestions.SaveSuccess, { sheetId: actualSheetId, name: savedName });
        } catch (error) {
            console.error(`[QuestionsManager] Error handling SaveClicked event:`, error);
            eventBus.emit(Events.Menu.CustomQuestions.SaveError, { name, error: error.message || 'Unknown save error' });
            // Emit feedback event as well
             eventBus.emit(Events.System.ShowFeedback, {
                 message: getTextTemplate('qmSaveError') || `Fout bij opslaan van '${name}'.`, 
                 level: "error"
             });
        }
    }

    /**
     * Handles the DeleteClicked event from the UI.
     * Calls the delete logic and emits success/error events.
     * @param {object} payload - The event payload.
     * @param {string} payload.sheetId - The ID of the sheet to delete.
     * @private
     */
    _handleDeleteCustomSheet = ({ sheetId }) => {
        console.log(`[QuestionsManager] Handling DeleteClicked event. Sheet ID: ${sheetId}`);
        try {
            // deleteCustomSheet now uses ConfirmationDialog and returns false immediately
            // The actual deletion and event emission happen in the dialog callback (inside deleteCustomSheet)
            // We just need to initiate it here.
            this.deleteCustomSheet(sheetId); 
            // No need to check return value or emit here anymore
            /*
            if (deleted) {
                eventBus.emit(Events.Menu.CustomQuestions.DeleteSuccess, { sheetId });
            } else {
                throw new Error('Sheet not found or deletion failed');
            }
            */
        } catch (error) {
            console.error(`[QuestionsManager] Error handling DeleteClicked event for sheet ${sheetId}:`, error);
            eventBus.emit(Events.Menu.CustomQuestions.DeleteError, { sheetId, error: error.message || 'Unknown delete error' });
            // Emit feedback event as well
             eventBus.emit(Events.System.ShowFeedback, {
                 message: `Fout bij verwijderen van lijst.`, 
                 level: "error"
             });
        }
    }

    /**
     * Handles the EditClicked event from the UI.
     * Loads the sheet data and emits an event to populate the form.
     * @param {object} payload - The event payload.
     * @param {string} payload.sheetId - The ID of the sheet to load for editing.
     * @private
     */
    _handleLoadSheetForEdit = ({ sheetId }) => {
        console.log(`[QuestionsManager] Handling EditClicked event. Sheet ID: ${sheetId}`);
        try {
            const sheetData = this.customSheets.get(sheetId);
            if (!sheetData) {
                throw new Error(`Sheet with ID ${sheetId} not found.`);
            }

            // Format questions back to text for the component (until component uses array directly)
            // TODO: Refactor component to accept question array directly
            const questionsText = this.formatQuestionsForTextarea(sheetData.questions);

            eventBus.emit(Events.Menu.CustomQuestions.SheetLoadedForEdit, {
                sheetId: sheetData.id, // Use the ID from the sheet data
                name: sheetData.name,
                questionsText: questionsText
            });

        } catch (error) {
             console.error(`[QuestionsManager] Error handling EditClicked event for sheet ${sheetId}:`, error);
             eventBus.emit(Events.Menu.CustomQuestions.LoadError, { sheetId, error: error.message || 'Unknown load error' });
              // Emit feedback event as well
              eventBus.emit(Events.System.ShowFeedback, {
                  message: `Fout bij laden van lijst voor bewerken.`, 
                  level: "error"
              });
        }
    }
}

// Create and export a singleton instance
const questionsManager = new QuestionsManager();
export default questionsManager; 