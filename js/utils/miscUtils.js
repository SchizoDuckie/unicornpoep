/**
 * Generates a simple unique ID.
 * @param {string} [prefix='id'] - Optional prefix for the ID.
 * @returns {string}
 */
function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Parses a single line of text into a question/answer object.
 * Expects format: "Question Text => Answer Text".
 * Returns null if the line is invalid (empty parts, wrong format).
 * @param {string} line - The line of text to parse.
 * @returns {{question: string, answer: string} | null}
 */
function parseQuestionLine(line) {
    if (!line || typeof line !== 'string') return null;
    const parts = line.split('=>');
    if (parts.length === 2) {
        const question = parts[0].trim();
        const answer = parts[1].trim();
        if (question && answer) {
            return { question, answer };
        } else {
            // console.warn(`[parseQuestionLine] Invalid format: Empty question or answer in line: "${line}"`);
            return null; // Empty question or answer part
        }
    } else {
        // console.warn(`[parseQuestionLine] Invalid format: "=>" separator not found or found multiple times in line: "${line}"`);
        return null; // Incorrect number of parts
    }
}

/**
 * Gets a text string from a hidden template element in the HTML.
 * @param {string} key - The value of the data-key attribute.
 * @param {object} [substitutions] - Optional map of placeholders (e.g., %NAME%) to replacement values.
 * @returns {string} The fetched and optionally substituted text, or the key itself if not found.
 */
export function getTextTemplate(key, substitutions) {
    const templateElement = document.querySelector(`data[data-translation-key="${key}"]`);
    if (!templateElement) {
        console.warn(`[getTextTemplate] Template not found for key: ${key}`);
        return key; // Return key as fallback
    }
    let text = templateElement.textContent || '';
    if (substitutions) {
        for (const placeholder in substitutions) {
            // Use a regex for global replacement
            text = text.replace(new RegExp(placeholder.replace(/[-\/\\^$*+.()|[\]{}]/g, '\\$&'), 'g'), substitutions[placeholder]);
        }
    }
    return text;
}

// Module-level cache to store generated names within the session
const generatedNamesCache = new Set();

// Load adjectives and nouns from the HTML datalists
function loadWordLists() {
    // Initialize with default fallback lists in case HTML elements aren't found
    let adjectivesList = [];
    let nounsList = [];
    
    try {
        // Get adjectives from datalist
        const adjectivesDatalist = document.getElementById('name-adjectives');
        if (adjectivesDatalist) {
            adjectivesList = Array.from(adjectivesDatalist.options).map(option => option.value);
            console.log(`[miscUtils] Loaded ${adjectivesList.length} adjectives from HTML.`);
        } else {
            console.warn('[miscUtils] Could not find name-adjectives datalist, using empty list.');
        }
        
        // Get nouns from datalist
        const nounsDatalist = document.getElementById('name-nouns');
        if (nounsDatalist) {
            nounsList = Array.from(nounsDatalist.options).map(option => option.value);
            console.log(`[miscUtils] Loaded ${nounsList.length} nouns from HTML.`);
        } else {
            console.warn('[miscUtils] Could not find name-nouns datalist, using empty list.');
        }
    } catch (error) {
        console.error('[miscUtils] Error loading word lists from HTML:', error);
    }
    
    return { adjectives: adjectivesList, nouns: nounsList };
}

// Load the word lists when the module is first loaded
const { adjectives, nouns } = loadWordLists();
const totalPossibleCombinations = adjectives.length * nouns.length;

/**
 * Generates a fun, random Unicorn-Poep themed player name.
 * Attempts to return a unique name within the current session until all combinations are exhausted.
 * @returns {string}
 */
function generateRandomPlayerName() {
    // Check if all combinations have been generated in this session
    if (generatedNamesCache.size >= totalPossibleCombinations) {
        console.warn("[generateRandomPlayerName] All unique combinations exhausted in this session. Clearing cache and allowing repeats.");
        generatedNamesCache.clear(); // Clear the cache to allow repeats
    }

    // Check if we have valid lists
    if (adjectives.length === 0 || nouns.length === 0) {
        console.warn("[generateRandomPlayerName] Word lists are empty. Using fallback name.");
        return "Vrolijke Eenhoorn"; // Fallback name
    }

    let attempts = 0;
    const maxAttempts = 100; // Increased attempts slightly for finding unique names

    while (attempts < maxAttempts) {
        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const potentialName = `${randomAdjective} ${randomNoun}`;

        // Check if the name is NOT already in the cache for this session
        if (!generatedNamesCache.has(potentialName)) {
            generatedNamesCache.add(potentialName); // Add to cache
            return potentialName; // Return the unique name
        }

        // If the name was already in the cache, loop again to try a new combination
        attempts++;
    }

    // Fallback if max attempts are reached without finding a unique name
    // (This should be rare, especially after clearing the cache)
    console.warn("[generateRandomPlayerName] Could not find a unique name after max attempts. Returning a default.");
    // Optionally, return a non-cached random one as a last resort instead of the fixed default
    const fallbackAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const fallbackNoun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${fallbackAdjective} ${fallbackNoun}`; // Return a random (possibly repeated) name
}

// Export functions individually if needed elsewhere,
// or export an object as default for consistency.
export default { generateId, parseQuestionLine, getTextTemplate, generateRandomPlayerName }; 