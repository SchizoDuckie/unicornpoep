class Highscores {
    constructor() {
        this.highscoresKey = "highscores"; // The key used for localStorage
        this.scores = this.fetchHighscores();
        this.highscoresElement = document.getElementById('scoreList');
    }

    fetchHighscores() {
        return JSON.parse(localStorage.getItem(this.highscoresKey)) || [];
    }

    /**
     * Displays the highscores in the game's UI.
     *
     */
    render() {
        // Sort highscores by score in descending order before displaying
        this.scores.sort((a, b) => b.score - a.score);
        this.highscoresElement.innerHTML = ''; // Clear current highscores

        this.scores.forEach((score, index) => {
            const scoreContainer = document.createElement('tr');
            scoreContainer.classList.add('score-container');
            if (index < 3) { // Highlight the top three scores
                scoreContainer.classList.add('top-score');
            }
            const gameNameCell = document.createElement('td');
            gameNameCell.textContent = score.gameName || '-';
            gameNameCell.classList.add('score-game-name');

            const rankCell = document.createElement('th');
            rankCell.textContent = index +1;
            rankCell.classList.add('score-rank');

            // Create columns for name, score, and timestamp
            const nameCell = document.createElement('td');
            nameCell.textContent = score.name;
            nameCell.classList.add('score-name');

            const scoreCell = document.createElement('td');
            scoreCell.textContent = score.score;
            scoreCell.classList.add('score-score');

            const timestampCell = document.createElement('td');
            // Convert timestamp to a readable date
            const date = new Date(score.timestamp);
            timestampCell.textContent = date.toLocaleDateString('nl-NL') + ' ' + date.toLocaleTimeString('nl-NL');
            timestampCell.classList.add('score-timestamp');

            // Append columns to the score container
            scoreContainer.appendChild(rankCell);
            scoreContainer.appendChild(gameNameCell);
            scoreContainer.appendChild(nameCell);
            scoreContainer.appendChild(scoreCell);
            scoreContainer.appendChild(timestampCell);

            // Append the score container to the highscores element
            this.highscoresElement.appendChild(scoreContainer);
        });
    }


    updateHighscore(gameName, name, score, timestamp) {
        const newHighscore = { gameName, name, score, timestamp };

        const highscores = this.fetchHighscores();
        highscores.push(newHighscore);
        highscores.sort((a, b) => b.score - a.score);

        localStorage.setItem(this.highscoresKey, JSON.stringify(highscores));
    }
}