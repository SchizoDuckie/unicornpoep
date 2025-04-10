class Highscores {
    constructor() {
        this.highscoresKey = "highscores"; // The key used for localStorage
        this.scores = this.fetchHighscores();
        this.highscoresElement = document.getElementById('scoreList');
        new KonamiCode(this.triggerRandomConfetti);

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
            gameNameCell.textContent = score.gameName || score.level || '-';
            gameNameCell.classList.add('score-game-name');

            const rankCell = document.createElement('th');
            let rank = index +1;
            switch (rank) {
                case 1:
                    rank = '🥇';
                    break;
                case 2:
                    rank = '🥈';
                    break;
                case 3:
                    rank = '🥉';
                    break;
            }
            rankCell.textContent = rank;
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


    async updateHighscore(sheetName, playerName, score, timestamp, isMultiplayer = false) {
        const key = `highscores_${sheetName}`;
        const entry = {
            player: playerName,
            score: score,
            date: timestamp,
            mode: isMultiplayer ? 'Multiplayer' : 'Single Player'
        };
        
        const highscores = JSON.parse(localStorage.getItem(key) || '[]');
        highscores.push(entry);
        
        // Sort descending and keep top 10
        highscores.sort((a, b) => b.score - a.score);
        localStorage.setItem(key, JSON.stringify(highscores.slice(0, 10)));
    }

    triggerRandomConfetti() {
        console.log("enabling easter egg click listeners");
        window.confettiStart = 0;
        window.addEventListener('mousedown', function() {
            window.confettiStart = new Date().getTime();
        })

        window.addEventListener('mouseup', (e) => {
            window.confettiAmount = new Date().getTime() - window.confettiStart;
            console.log("Confetti: ", window.confettiAmount);
            // Define the possible directions for the confetti
            const directions = ['top', 'bottom', 'left', 'right'];
            // Pick a random direction
            const direction = directions[Math.floor(Math.random() * directions.length)];

            // Your confetti triggering logic goes here, using the chosen direction
            // For example, using canvas-confetti (make sure you have included the canvas-confetti library):
            const xPosition = event.pageX / window.innerWidth;
            const yPosition = event.pageY / window.innerHeight;
            confetti({
                startVelocity: 30,
                particleCount: 20,
                spread: Math.floor(Math.random() * 360),
                origin: { x: xPosition, y: yPosition }
            });
        })

    }
}

class KonamiCode {
    constructor(callback) {
        this.konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];
        this.currentPosition = 0;
        this.callback = callback;

        document.addEventListener('keydown', (event) => this.checkKonamiCode(event));
    }

    checkKonamiCode(event) {
        if (event.code === this.konamiSequence[this.currentPosition]) {
            this.currentPosition++;

            if (this.currentPosition === this.konamiSequence.length) {
                this.callback(); // Trigger the callback function when the full sequence is entered
                this.currentPosition = 0; // Reset the position for the next attempt
            }
        } else {
            this.currentPosition = 0; // Reset the position if the wrong key is pressed
        }
    }
}
