import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';


// Add V1 constants
const STORAGE_KEY_PREFIX = "unicornpoep_highscore_";
const MAX_ENTRIES_PER_SHEET = 20;

/**
 * Manages loading, saving, and retrieving highscores from localStorage
 * using the v1 multi-key approach (one key per sheet/difficulty).
 * This service is called by coordinators (e.g., UIManager, GameCoordinator)
 * in response to application events. It does not listen for events itself.
 */
class HighscoreManager {
    constructor() {
        console.info("[HighscoreManager] Initializing (V1 Multi-Key Storage Service)...");
    }

    /**
     * Generates a unique key for storing scores based on sheet and difficulty.
     * Sanitizes and truncates the key for safety.
     * Mirrors the v1 logic precisely.
     * @param {string} sheetKey - Combined sheet names (e.g., 'Tafel van 2,Tafel van 3').
     * @param {string|null} difficulty - Difficulty level ('easy', 'medium', 'hard') or null for practice.
     * @returns {string} The localStorage key.
     * @private
     */
    _getStorageKey(sheetKey, difficulty) {
        const diffSuffix = difficulty ? `_${difficulty}` : '_practice';
        // Sanitize: Replace non-alphanumeric (allow ,-_) with _, lowercase
        const safeSheetKey = (sheetKey || 'unknown').replace(/[^a-z0-9,\-_]/gi, '_').toLowerCase();
        // Truncate to prevent excessively long keys - match V1 exactly
        const truncatedKey = safeSheetKey.length > 50 ? safeSheetKey.substring(0, 50) : safeSheetKey;
        return `${STORAGE_KEY_PREFIX}${truncatedKey}${diffSuffix}`;
    }

    /**
     * Retrieves scores for a specific game configuration synchronously from localStorage.
     * Handles potential JSON parsing errors. Mirrors v1 logic.
     * @param {string} sheetKey - The identifier for the sheets played.
     * @param {string|null} difficulty - The difficulty level.
     * @param {string} mode - The game mode ('single', 'multiplayer', 'practice').
     * @returns {Array<object>} An array of score objects, empty if error or not found.
     * @private
     */
    _getScoresForSheetSync(sheetKey, difficulty, mode) {
        let storageKey;
        if (mode === 'single') {
            storageKey = this._getSinglePlayerStorageKeyV1(sheetKey);
        } else {
            storageKey = this._getStorageKey(sheetKey, difficulty);
        }

        try {
            const storedData = localStorage.getItem(storageKey);
            if (!storedData) return []; // No data found

            const parsed = JSON.parse(storedData);
            // Ensure the parsed data is actually an array and validate basic structure
            if (Array.isArray(parsed) && parsed.every(s => typeof s === 'object' && s !== null && 'player' in s && 'score' in s)) {
                // Map to ensure consistent structure, deriving gameName for single player V1 entries
                return parsed.map(score => ({
                    player: score.player || getTextTemplate('hsDefaultPlayerName'),
                    score: score.score,
                    date: score.date, // Pass date as is
                    // V1: gameName exists only in multi entries. For single, use sheetKey.
                    gameName: score.gameName || sheetKey,
                    mode: score.mode || (mode === 'single' ? 'Single Player' : 'Multi'), // Infer mode if missing based on key type
                    difficulty: score.difficulty || difficulty || '-', // Map difficulty
                }));
            } else {
                 console.warn(`[HighscoreManager] Invalid data format (not a valid score array) for key ${storageKey}. Removing.`);
                 localStorage.removeItem(storageKey);
                 return [];
            }
        } catch (error) {
            console.error(`[HighscoreManager] Error retrieving or parsing sync scores from ${storageKey}:`, error);
            // If parsing fails, assume data is corrupt and remove it
            localStorage.removeItem(storageKey);
            return [];
        }
    }

    /**
     * Generates the V1-style key for single-player scores.
     * @param {string} sheetKey - The sheet name(s).
     * @returns {string} The localStorage key.
     * @private
     */
    _getSinglePlayerStorageKeyV1(sheetKey) {
        // V1 simple prefix + sheet key
        const safeSheetKey = (sheetKey || 'unknown').replace(/[^a-z0-9,\-_ ]/gi, '_'); // Allow spaces as per V1 example 'Tafel van 3'
        return `highscores_${safeSheetKey}`;
    }

    /**
     * Adds a new score entry for a specific game configuration.
     * Saves to the specific localStorage key for the sheet/difficulty.
     * @param {string} playerName - Player's name.
     * @param {number} score - Score achieved.
     * @param {string} sheetKey - Identifier for the sheets played (e.g., 'Tafel van 2,Tafel van 3').
     * @param {string} mode - Game mode ('single', 'multiplayer', 'practice'). Note: V1 used 'Single Player'/'Multi'
     * @param {string|null} difficulty - Difficulty level ('easy', 'medium', 'hard') or null for practice.
     * @returns {boolean} True if the score qualified and was saved, false otherwise.
     */
    addHighscore(playerName, score, sheetKey, mode, difficulty) {
        // Prevent saving scores for practice mode or non-positive scores
        if (mode === 'practice' || !difficulty || score <= 0) {
            console.log("[HighscoreManager] Skipping score save (practice mode, no difficulty, or zero/negative score).");
            return false; // Score didn't qualify or shouldn't be saved
        }

        // Basic validation
        if (typeof playerName !== 'string' || typeof score !== 'number' || !sheetKey || !mode) {
            console.warn(`[HighscoreManager] Invalid score attempt: Missing data. Player='${playerName}', Score=${score}, Sheet='${sheetKey}', Mode='${mode}', Diff='${difficulty}'`);
            return false;
        }

        let storageKey;
        if (mode === 'single') {
            storageKey = this._getSinglePlayerStorageKeyV1(sheetKey);
        } else if (mode === 'multiplayer') {
            // Existing logic for multiplayer/practice keys
            storageKey = this._getStorageKey(sheetKey, difficulty);
        } else {
            // Practice mode saving is already skipped earlier, but handle defensively
            console.warn("[HighscoreManager] Attempted to save score for unexpected mode:", mode);
            return false;
        }

        const timestamp = new Date().toISOString();

        // --- FIX: Normalize sheetKey format before using it --- 
        let normalizedSheetKey = (sheetKey || 'Unknown Game').replace(/_/g, ':'); // Replace all underscores with colons
        // Handle cases with multiple sheets joined by ", " - normalize each part
        if (normalizedSheetKey.includes(', ')) {
            normalizedSheetKey = normalizedSheetKey.split(', ')
                                             .map(part => part.replace(/_/g, ':'))
                                             .join(', ');
        }
        // --- END FIX ---

        // Format gameName according to V1 screenshot example - now uses normalized key
        let formattedGameName = normalizedSheetKey; // Start with the normalized sheet key
        if (mode === 'multiplayer' && difficulty) {
            // Capitalize difficulty for display
            const difficultyDisplay = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
            formattedGameName = `${normalizedSheetKey} (Multiplayer ${difficultyDisplay})`; // Use normalized key here too
        } else if (mode === 'single') {
            // V1 examples just show the sheet name for single player
            // formattedGameName = sheetKey; // Already set
        }
        // Handle potential practice mode display if needed, although V1 didn't save these usually

        // Construct the entry matching V1 structure more closely
        const entry = {
            player: playerName,
            score: score,
            date: timestamp,
            // Store the raw mode/difficulty internally if needed, but gameName is primary for V1 display
            mode: mode === 'single' ? 'Single Player' : (mode === 'multiplayer' ? 'Multi' : 'Practice'),
            difficulty: difficulty // Store the raw difficulty string
        };

        // *** V1 Alignment: ONLY add gameName for multiplayer games ***
        if (mode === 'multiplayer') {
            entry.gameName = formattedGameName;
        }

        try {
            // 1. Load scores for the specific sheet/difficulty
            const currentScores = this._getScoresForSheetSync(sheetKey, difficulty, mode);

            // 2. Check if it qualifies (top N or list not full)
            if (currentScores.length < MAX_ENTRIES_PER_SHEET || score > (currentScores[currentScores.length - 1]?.score || 0)) {

                // 3. Add the new score
                currentScores.push(entry);

                // 4. Sort descending by score, then ascending by date for ties (mirror V1)
                currentScores.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    const dateA = new Date(a.date); const dateB = new Date(b.date);
                    // Handle potential invalid dates during sort
                    return (!isNaN(dateA) && !isNaN(dateB)) ? dateA - dateB : 0;
                });

                // 5. Keep only top N entries
                const updatedScores = currentScores.slice(0, MAX_ENTRIES_PER_SHEET);

                // 6. Save back to the specific key
                localStorage.setItem(storageKey, JSON.stringify(updatedScores));
                console.log(`[HighscoreManager] Score saved to V1-compatible key: ${storageKey}`);
                return true; // Score was added and saved

            } else {
                 console.log(`[HighscoreManager] Score ${score} by ${playerName} for ${sheetKey} (${difficulty}) not high enough.`);
                 return false; // Score did not qualify
            }
        } catch (error) {
            console.error(`[HighscoreManager] Error saving score to ${storageKey}:`, error);
            eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('hsSaveError'), level: 'error' });
            return false; // Error occurred
        }
    }

    /**
     * Retrieves all scores from localStorage across all relevant V1 keys.
     * Handles potential JSON parsing errors for individual keys.
     * @returns {Array<object>} An array of all score objects, sorted globally by score descending.
     * @private
     */
    _getAllScoresFromStorage() {
        let allScores = [];
        try {
            const keys = Object.keys(localStorage);
            for (const key of keys) {
                // Check if key matches EITHER V1 single-player OR V1 multiplayer prefix
                if (key.startsWith(STORAGE_KEY_PREFIX) || key.startsWith('highscores_')) {
                    const storedData = localStorage.getItem(key);
                    if (storedData) {
                        try {
                            const sheetScores = JSON.parse(storedData);
                            if (Array.isArray(sheetScores) && sheetScores.every(s => typeof s === 'object' && s !== null && 'player' in s && 'score' in s)) {
                                // Map to ensure consistent structure expected by the component
                                const mappedScores = sheetScores.map(score => {
                                    let gameNameFallback = 'Unknown';
                                    if (key.startsWith('highscores_')) {
                                        // For single-player keys, the game name is derived directly from the key
                                        gameNameFallback = key.substring('highscores_'.length);
                                    } else if (key.startsWith(STORAGE_KEY_PREFIX)) {
                                        // For multiplayer keys, try extracting from the key if gameName isn't stored (should be rare)
                                        gameNameFallback = this._extractSheetKeyFromStorageKey(key) || 'Unknown';
                                    }

                                    return {
                                        player: score.player || getTextTemplate('hsDefaultPlayerName'),
                                        score: score.score,
                                        date: score.date, // Pass date as is
                                        // Use stored gameName if present (V1 multi), otherwise use the derived fallback (V1 single/corner cases)
                                        gameName: score.gameName || gameNameFallback,
                                        // Mode/difficulty might not be stored reliably in V1 single-player entries
                                        mode: score.mode || (key.startsWith('highscores_') ? 'Single Player' : '-'), // Infer mode if missing
                                        difficulty: score.difficulty || this._extractDifficultyFromStorageKey(key) || '-', // Difficulty mostly from multi keys
                                    };
                                });
                                allScores = allScores.concat(mappedScores);
                            } else {
                                 console.warn(`[HighscoreManager] Invalid data format (not a valid score array) for key ${key}. Removing.`);
                                 localStorage.removeItem(key);
                            }
                        } catch (parseError) {
                            console.warn(`[HighscoreManager] Failed to parse scores for key ${key}. Removing.`, parseError);
                            localStorage.removeItem(key); // Remove corrupted data
                        }
                    }
                }
            }
            // Sort all collected scores globally by score descending
            allScores.sort((a, b) => b.score - a.score);
            return allScores;
        } catch (error) {
            // Catch potential errors during key iteration (less likely)
            console.error("[HighscoreManager] Error retrieving all scores:", error);
            return []; // Return empty array on major error
        }
    }

    /**
     * Helper to try and extract the original sheet key part from a storage key.
     * @param {string} storageKey - The full localStorage key.
     * @returns {string|null} The extracted sheet key or null.
     * @private
     */
    _extractSheetKeyFromStorageKey(storageKey) {
        if (!storageKey || !storageKey.startsWith(STORAGE_KEY_PREFIX)) return null;
        const base = storageKey.substring(STORAGE_KEY_PREFIX.length);
        const difficultyParts = ['_easy', '_medium', '_hard', '_practice'];
        for (const suffix of difficultyParts) {
            if (base.endsWith(suffix)) {
                return base.substring(0, base.length - suffix.length);
            }
        }
        // If no known difficulty suffix, return the whole base part (might be practice w/o suffix?)
        return base;
    }

    /**
     * Helper to try and extract the difficulty part from a storage key.
     * @param {string} storageKey - The full localStorage key.
     * @returns {string|null} The extracted difficulty or null.
     * @private
     */
     _extractDifficultyFromStorageKey(storageKey) {
        if (!storageKey) return null;
        if (storageKey.endsWith('_easy')) return 'easy';
        if (storageKey.endsWith('_medium')) return 'medium';
        if (storageKey.endsWith('_hard')) return 'hard';
        if (storageKey.endsWith('_practice')) return 'practice'; // Or null/N/A depending on preference
        return null; // No difficulty suffix found
    }

    /**
     * Checks if a given score qualifies as a new highscore for the specified sheet/difficulty.
     * Mirrors V1 logic.
     * @param {string} sheetKey - The identifier for the sheets played.
     * @param {string|null} difficulty - The difficulty level.
     * @param {number} score - The score to check.
     * @returns {boolean} True if the score is a new highscore, false otherwise.
     */
     isNewHighScore(sheetKey, difficulty, score) {
        // Practice mode doesn't have highscores handled here, and score must be positive
        if (!difficulty || score <= 0) {
            return false;
        }

        try {
            const currentScores = this._getScoresForSheetSync(sheetKey, difficulty, 'multiplayer');

            // If the list isn't full, any positive score qualifies
            if (currentScores.length < MAX_ENTRIES_PER_SHEET) {
                return true;
            }

            // If the list is full, check against the lowest score
            // Use nullish coalescing for safety in case the last entry is malformed (though validation should prevent this)
            const lowestScore = currentScores[currentScores.length - 1]?.score ?? 0;
            return score > lowestScore;

        } catch (error) {
            console.error(`[HighscoreManager] Error checking for new highscore for ${sheetKey} (${difficulty}):`, error);
            return false; // Fail safe: assume not a highscore on error
        }
    }

    /**
     * Loads all V1 highscores from localStorage, sorts them, and emits
     * the result via the event bus. Intended to be called by a coordinator
     * (e.g., UIManager) when the highscores view is requested.
     * Emits Events.Menu.Highscores.Loaded on success, LoadFailed on error.
     */
    loadAndEmitAllScores() {
        console.log("[HighscoreManager] loadAndEmitAllScores called (V1 mode).");
        try {
             // Load scores using the V1-compatible multi-key method
             const allScores = this._getAllScoresFromStorage(); // Use the existing private method
             console.log(`[HighscoreManager] Emitting ${allScores.length} total scores from V1-compatible storage for display.`);
             eventBus.emit(Events.Menu.Highscores.Loaded, { scores: allScores });
        } catch (error) {
             console.error("[HighscoreManager] Error loading scores for display:", error);
             eventBus.emit(Events.Menu.Highscores.LoadFailed, { message: getTextTemplate('hsLoadErrorGeneric') });
        }
    }

    // Potential method to clear ALL V1 highscores (use with caution)
    /*
    clearAllV1Highscores() {
        try {
            const keys = Object.keys(localStorage);
            let removedCount = 0;
            for (const key of keys) {
                if (key.startsWith(STORAGE_KEY_PREFIX)) {
                    localStorage.removeItem(key);
                    removedCount++;
                }
            }
            console.log(`[HighscoreManager] Cleared ${removedCount} V1 highscore entries.`);
            // Optionally refresh display if currently shown
            if (document.getElementById('highscores')?.style.display !== 'none') { // Basic check if view might be active
                 this._handleShowRequest();
            }
        } catch (error) {
            console.error("[HighscoreManager] Error clearing V1 highscores:", error);
            eventBus.emit(Events.System.ShowFeedback, { message: 'Error clearing highscores.', level: 'error' });
        }
    }
    */
}

// Create and export a singleton instance
const highscoreManager = new HighscoreManager();
export default highscoreManager;
