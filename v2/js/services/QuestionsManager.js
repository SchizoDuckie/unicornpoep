import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

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
        this.customSheets = new Map(); // Stores { name, questions: [{ question, answer }] }
        this.loadedQuestionsCache = new Map(); // Caches parsed CATEGORY OBJECTS keyed by FILE ID (e.g., 'tafels')
        this.selectableItems = []; // Holds { id: string, name: string, isCustom: boolean } for UI
        this.isInitialized = false;
        this.initializationPromise = null;
        this.initialize();

        console.info("[QuestionsManager] Instance created. Initialization started.");
    }

    /**
     * Initializes the QuestionsManager by discovering default sheets from config.json
     * and loading custom sheets from localStorage.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     */
    async initialize() {
        if (this.initializationPromise) return this.initializationPromise;
        console.log("[QuestionsManager] Starting initialization (V1 Category Logic)...");

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
                name: sheetData.name || 'Naamloos', // Use stored name
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
                if (typeof parsedData === 'object' && parsedData !== null) {
                    this.customSheets = new Map(Object.entries(parsedData));
                    // console.log(`[QuestionsManager] Loaded ${this.customSheets.size} custom sheets data.`);
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
            eventBus.emit(Events.System.ErrorOccurred, { message: 'Kon eigen vragenlijsten niet opslaan.', error });
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

                const parts = trimmedLine.split('=>');
                if (parts.length === 2) {
                    const question = parts[0].trim();
                    const answer = parts[1].trim();
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
                } else {
                     let cumulativeLine = 1;
                     for(let i = 0; i < catIndex; i++) {
                        cumulativeLine += categories[i].split('\n').length + 1;
                     }
                     cumulativeLine += lineIndex + 1;

                    firstErrorLine = cumulativeLine;
                    firstErrorMessage = `Ongeldig formaat op regel ~${firstErrorLine} in sheet '${sheetIdForLogging}' (Categorie: '${title}'): Gebruik "Vraag => Antwoord".`;
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
     * Parses raw text (expected format: Question => Answer per line)
     * and saves it as a custom question sheet (flat array).
     * NOTE: This uses a different parsing than default sheets.
     * @param {string} sheetId - A unique ID for the sheet.
     * @param {string} name - The user-defined name for the sheet.
     * @param {string} questionsText - The raw text input (Vraag => Antwoord format).
     * @returns {Promise<boolean>} True if successful, false otherwise.
     * @throws {Error} If parsing fails.
     */
    async saveCustomSheetFromText(sheetId, name, questionsText) {
        await this._ensureInitialized();
        if (!sheetId || !name || typeof questionsText !== 'string') {
            console.error("[QuestionsManager] Invalid data provided for saveCustomSheetFromText.");
            return false;
        }
        console.log(`[QuestionsManager] Parsing and saving custom sheet: ${name} (${sheetId})`);
        try {
            // --- Parse flat list specifically for custom input ---
            const lines = questionsText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('//'));
            const questions = [];
            let firstErrorLine = -1;
            let firstErrorMessage = null;
            lines.forEach((line, index) => {
                 if (firstErrorMessage) return;
                 const parts = line.split('=>');
                 if (parts.length === 2) {
                     const question = parts[0].trim();
                     const answer = parts[1].trim();
                     if (question && answer) {
                         questions.push({ question, answer });
                     } else {
                         firstErrorLine = index + 1;
                         firstErrorMessage = `Ongeldig formaat op regel ${firstErrorLine}: Lege vraag of antwoord.`;
                     }
                 } else {
                     firstErrorLine = index + 1;
                     firstErrorMessage = `Ongeldig formaat op regel ${firstErrorLine}: Gebruik "Vraag => Antwoord".`;
                 }
            });
             if (firstErrorMessage) throw new Error(firstErrorMessage);
            // --- End flat list parsing ---

            if (questions.length === 0) {
                console.warn(`[QuestionsManager] No valid questions found in text for custom sheet ${name}, not saving.`);
                throw new Error("Geen geldige vragen gevonden in de invoer.");
            }
            // Save the parsed data (as flat array for custom sheets)
            this.customSheets.set(sheetId, { name, questions });
            this._saveCustomSheets();
            return true;
        } catch (error) {
            console.error(`[QuestionsManager] Error parsing or saving custom sheet ${name}:`, error);
            throw error; // Re-throw the parsing error
        }
    }

    /**
     * Adds or updates a custom question sheet (using pre-parsed questions).
     * Kept for potential internal use or if coordinator parses first.
     * @param {string} sheetId - A unique ID for the sheet (e.g., custom_timestamp).
     * @param {string} name - The user-defined name for the sheet.
     * @param {Array<object>} questions - The array of question objects.
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async saveCustomSheet(sheetId, name, questions) {
        await this._ensureInitialized();

        if (!sheetId || !name || !Array.isArray(questions)) {
            console.error("[QuestionsManager] Invalid data provided for saveCustomSheet.");
            return false;
        }
        console.log(`[QuestionsManager] Saving custom sheet: ${name} (${sheetId}) with ${questions.length} questions.`);
        this.customSheets.set(sheetId, { name, questions });
        this._saveCustomSheets();
        return true;
    }

    /**
     * Deletes a custom sheet by its ID.
     * @param {string} sheetId
     * @returns {Promise<boolean>} True if deleted, false if not found.
     */
    async deleteCustomSheet(sheetId) {
        await this._ensureInitialized();
        if (this.customSheets.has(sheetId)) {
            this.customSheets.delete(sheetId);
            this._saveCustomSheets();
            console.log(`[QuestionsManager] Deleted custom sheet: ${sheetId}`);
            return true;
        }
        console.warn(`[QuestionsManager] Attempted to delete non-existent custom sheet: ${sheetId}`);
        return false;
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
                    throw new Error(`Categorie '${categoryTitle}' niet gevonden in bestand '${fileId}'.`);
                }
            } else {
                // This means the file wasn't loaded/cached during init, which is an error
                console.error(`[QuestionsManager] File data for '${fileId}' not found in cache for selectable ID: ${selectableId}. Initialization incomplete?`);
                throw new Error(`Basisdata voor '${fileId}' kon niet worden geladen.`);
            }
        } else {
             // 3. ID is not custom and not a valid composite ID format
             console.error(`[QuestionsManager] Invalid selectable ID format or sheet not found: ${selectableId}`);
             throw new Error(`Selectie '${selectableId}' is ongeldig of niet gevonden.`);
        }
    }

    /**
     * Gets a display-friendly name for a given sheet ID.
     * Placeholder implementation - adjust based on how sheet data is stored.
     * @param {string} sheetId - The ID of the sheet (e.g., 'default_1', 'custom_abc').
     * @returns {string|null} The display name or null if not found.
     */
    getSheetDisplayName(sheetId) {
        // Find in default categories
        const defaultSheet = this.defaultCategories.find(cat => cat.id === sheetId);
        if (defaultSheet) {
            return defaultSheet.name;
        }
        // Find in custom sheets (assuming they are stored with id and name)
        const customSheet = this.customSheets.find(sheet => sheet.id === sheetId);
        if (customSheet) {
            return customSheet.name; // Assuming custom sheets have a 'name' property
        }
        console.warn(`[QuestionsManager] Display name not found for sheetId: ${sheetId}`);
        return null; // Not found
    }
}

// Create and export a singleton instance
const questionsManager = new QuestionsManager();
export default questionsManager; 