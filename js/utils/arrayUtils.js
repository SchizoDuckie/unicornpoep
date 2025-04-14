/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @template T
 * @param {T[]} array - The array to shuffle.
 * @returns {T[]} The shuffled array (the same array instance).
 */
function shuffleArray(array) {
    if (!Array.isArray(array)) {
        console.warn("shuffleArray called with non-array:", array);
        return array; // Return input if not an array
    }
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
}

// Export as default object
export default { shuffleArray }; 