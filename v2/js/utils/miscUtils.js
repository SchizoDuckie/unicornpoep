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

/**
 * Generates a fun, random Unicorn-Poep themed player name, avoiding grammatically incorrect combinations.
 * @returns {string}
 */
function generateRandomPlayerName() {
    const adjectives = [
        "Glimmende", "Regenboog", // Regenboog often used as is.
        "Sprankelende", "Vrolijke", "Dappere", "Snelle",
        "Slimme", "Knetterende", "Blitse", "Gestoorde", "Krankzinnige", 
        "Ruftende", "Zingende", "Idiote", "Spugende", "Geprakte", "Blaffende",
        "Fluffy" // Loanword, stays as is
    ];
    const nouns = [
        "Eenhoorn", "Drol", "Scheet", "Banaan", "Wolk", "Ster", "Hartje",
        "Donut", "Muffin", "Drol", "Fee", "Kabouter", "Elfje", "Pannenkoek", "Banaan",
        "Knakworst", "Kroket", "Kaassoufflé", "Bamischijf", "Bal Gehakt"
    ];

    const diminutiveEndings = ['je', 'tje'];

    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loops in edge cases

    while (attempts < maxAttempts) {
        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

        const isDiminutive = diminutiveEndings.some(ending => randomNoun.endsWith(ending));
        const isProblematicAdjective = randomAdjective.endsWith('e');

        // If it's NOT a combination of a problematic adjective AND a diminutive noun, it's valid
        if (!(isProblematicAdjective && isDiminutive)) {
            return `${randomAdjective} ${randomNoun}`;
        }

        attempts++;
    }

    // Fallback in case no valid combination is found quickly (should be rare)
    console.warn("[generateRandomPlayerName] Could not find a valid adjective/noun combination after max attempts. Returning a default.");
    return "Vrolijke Eenhoorn"; // Or pick a known safe default
}

// Export functions individually if needed elsewhere,
// or export an object as default for consistency.
export default { generateId, parseQuestionLine, getTextTemplate, generateRandomPlayerName }; 