/**
 * Manages loading, saving, and retrieving highscores from localStorage.
 * Separated from the controller for better data management.
 */
class HighscoresManager {
    /**
     * Initializes the manager, setting storage key prefix and entry limit.
     */
    constructor() {
        this.storageKeyPrefix = "unicornpoep_highscore_";
        this.maxEntriesPerSheet = 20;
    }

    /**
     * Generates a unique key for storing scores based on sheet and difficulty.
     * Sanitizes and truncates the key for safety.
     * @param {string} sheetKey - Combined sheet names.
     * @param {string|null} difficulty - Difficulty level or null.
     * @returns {string} The localStorage key.
     */
    getStorageKey(sheetKey, difficulty) {
        const diffSuffix = difficulty ? `_${difficulty}` : '_practice';
        // Sanitize: Replace non-alphanumeric (allow ,-_) with _, lowercase
        const safeSheetKey = (sheetKey || 'unknown').replace(/[^a-z0-9,\-_]/gi, '_').toLowerCase();
        // Truncate to prevent excessively long keys
        const truncatedKey = safeSheetKey.length > 50 ? safeSheetKey.substring(0, 50) : safeSheetKey;
        return `${this.storageKeyPrefix}${truncatedKey}${diffSuffix}`;
    }

    /**
     * Adds a new score entry for a specific game configuration (test mode or multiplayer).
     * Ensures scores are sorted and capped.
     * @param {string} sheetKey - Identifier for the sheets played.
     * @param {string} playerName - Player's name.
     * @param {number} score - Score achieved.
     * @param {boolean} isMultiplayer - Was the game multiplayer?
     * @param {string|null} difficulty - Difficulty level.
     * @returns {Promise<void>} Resolves when saving is complete, rejects on error.
     * @async
     */
    async addScore(sheetKey, playerName, score, isMultiplayer, difficulty) {
        // Only save scores if not practice mode and score is positive
        if ((!difficulty && !isMultiplayer) || score <= 0) {
            console.log("Skipping score save (practice mode or zero/negative score).");
            return Promise.resolve();
        }

        const storageKey = this.getStorageKey(sheetKey, difficulty);
        const timestamp = new Date().toISOString();
        const entry = {
            gameName: sheetKey,
            player: playerName,
            score: score,
            date: timestamp,
            mode: isMultiplayer ? 'Multi' : 'Single', // Shortened mode name
            difficulty: difficulty || 'N/A'
        };

        return new Promise((resolve, reject) => {
            try {
                // Use synchronous retrieval for immediate update
                const scores = this.getScoresForSheetSync(sheetKey, difficulty);
                scores.push(entry);

                // Sort descending by score, then ascending by date for ties
                scores.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    const dateA = new Date(a.date); const dateB = new Date(b.date);
                    return (!isNaN(dateA) && !isNaN(dateB)) ? dateA - dateB : 0;
                });

                // Keep only top entries
                const updatedScores = scores.slice(0, this.maxEntriesPerSheet);

                localStorage.setItem(storageKey, JSON.stringify(updatedScores));
                console.log(`Score saved to key: ${storageKey}`);
                resolve(); // Resolve on successful save
            } catch (error) {
                console.error(`Error saving score to ${storageKey}:`, error);
                reject(error); // Reject the promise on error
            }
        });
    }

    /**
     * Retrieves scores for a specific game configuration synchronously from localStorage.
     * Handles potential JSON parsing errors.
     * @param {string} sheetKey - The identifier for the sheets played.
     * @param {string|null} difficulty - The difficulty level.
     * @returns {Array<object>} An array of score objects, empty if error or not found.
     */
    getScoresForSheetSync(sheetKey, difficulty) {
        const storageKey = this.getStorageKey(sheetKey, difficulty);
        try {
            const storedData = localStorage.getItem(storageKey);
            if (!storedData) return []; // No data found
            const parsed = JSON.parse(storedData);
            // Ensure the parsed data is actually an array
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error(`Error retrieving or parsing sync scores from ${storageKey}:`, error);
            // If parsing fails, assume data is corrupt and remove it
            localStorage.removeItem(storageKey);
            return [];
        }
    }

    /**
     * Retrieves all scores from localStorage across all relevant keys.
     * Handles potential JSON parsing errors for individual keys.
     * @returns {Promise<Array<object>>} A promise resolving to an array of all score objects.
     * @async
     */
    async getAllScores() {
        // This can remain async for potential future storage changes,
        // but currently uses synchronous localStorage access.
        return new Promise((resolve) => {
            let allScores = [];
            try {
                const keys = Object.keys(localStorage);
                for (const key of keys) {
                    // Check if key exists and matches prefix using optional chaining
                    if (key.startsWith(this.storageKeyPrefix)) {
                        const storedData = localStorage.getItem(key);
                        if (storedData) {
                            try {
                                const sheetScores = JSON.parse(storedData);
                                if (Array.isArray(sheetScores)) {
                                    // Basic validation of score objects could be added here
                                    allScores = allScores.concat(sheetScores);
                                } else {
                                     console.warn(`Invalid data format (not an array) for key ${key}. Removing.`);
                                     localStorage.removeItem(key);
                                }
                            } catch (parseError) {
                                console.warn(`Failed to parse scores for key ${key}. Removing.`, parseError);
                                localStorage.removeItem(key); // Remove corrupted data
                            }
                        }
                    }
                }
                resolve(allScores);
            } catch (error) {
                // Catch potential errors during key iteration (less likely)
                console.error("Error retrieving all scores:", error);
                resolve([]); // Resolve with empty array on major error
            }
        });
    }

    /**
     * Checks if a given score qualifies as a new highscore for the specified sheet/difficulty.
     * @param {string} sheetKey - The identifier for the sheets played.
     * @param {string|null} difficulty - The difficulty level.
     * @param {number} score - The score to check.
     * @returns {boolean} True if the score is a new highscore, false otherwise.
     */
    isNewHighScore(sheetKey, difficulty, score) {
        // Practice mode doesn't have highscores handled here
        if (!difficulty || score <= 0) {
            return false;
        }

        try {
            const currentScores = this.getScoresForSheetSync(sheetKey, difficulty);

            // If the list isn't full, any positive score is "new"
            if (currentScores.length < this.maxEntriesPerSheet) {
                return true;
            }

            // If the list is full, check against the lowest score
            const lowestScore = currentScores[currentScores.length - 1].score ?? 0;
            return score > lowestScore;

        } catch (error) {
            console.error(`Error checking for new highscore for ${sheetKey} (${difficulty}):`, error);
            return false; // Fail safe: assume not a highscore on error
        }
    }
}