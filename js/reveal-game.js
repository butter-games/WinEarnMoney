const RevealGame = (() => {
  // Celebrity data with freely available Wikimedia Commons images
  const celebrities = [
    {
      name: "Dwayne Johnson",
      aliases: ["the rock", "dwayne", "rock"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Dwayne_Johnson_2014_%28cropped%29.jpg/440px-Dwayne_Johnson_2014_%28cropped%29.jpg",
      hint: "Known for wrestling and action movies",
    },
    {
      name: "Taylor Swift",
      aliases: ["taylor", "swift"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Taylor_Swift_at_the_2023_MTV_Video_Music_Awards_%283%29.png/440px-Taylor_Swift_at_the_2023_MTV_Video_Music_Awards_%283%29.png",
      hint: "Pop superstar who started in country music",
    },
    {
      name: "Leonardo DiCaprio",
      aliases: ["leonardo", "dicaprio", "leo dicaprio"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Leonardo_Dicaprio_Cannes_2019.jpg/440px-Leonardo_Dicaprio_Cannes_2019.jpg",
      hint: "Oscar winner, starred in Titanic",
    },
    {
      name: "Beyonce",
      aliases: ["beyonce", "beyoncé", "queen bey"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Beyonc%C3%A9_at_The_Lion_King_European_Premiere_2019.png/440px-Beyonc%C3%A9_at_The_Lion_King_European_Premiere_2019.png",
      hint: "Former Destiny's Child member, 'Single Ladies' singer",
    },
    {
      name: "Cristiano Ronaldo",
      aliases: ["ronaldo", "cristiano", "cr7"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Cristiano_Ronaldo_2018.jpg/440px-Cristiano_Ronaldo_2018.jpg",
      hint: "Portuguese soccer legend, known as CR7",
    },
    {
      name: "Oprah Winfrey",
      aliases: ["oprah", "winfrey"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Oprah_in_2014.jpg/440px-Oprah_in_2014.jpg",
      hint: "Talk show queen turned media mogul",
    },
    {
      name: "Tom Cruise",
      aliases: ["cruise", "tom"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Tom_Cruise_by_Gage_Skidmore_2.jpg/440px-Tom_Cruise_by_Gage_Skidmore_2.jpg",
      hint: "Mission Impossible star, known for doing own stunts",
    },
    {
      name: "Elon Musk",
      aliases: ["elon", "musk"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg/440px-Elon_Musk_Royal_Society_%28crop2%29.jpg",
      hint: "CEO of Tesla and SpaceX",
    },
    {
      name: "Rihanna",
      aliases: ["rihanna", "riri"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Rihanna_Fenty_2018.png/440px-Rihanna_Fenty_2018.png",
      hint: "Barbadian singer and Fenty Beauty founder",
    },
    {
      name: "Lionel Messi",
      aliases: ["messi", "lionel", "leo messi"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg/440px-Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg",
      hint: "Argentine soccer star, World Cup winner 2022",
    },
    {
      name: "Ariana Grande",
      aliases: ["ariana", "grande"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Ariana_Grande_Grammys_Red_Carpet_2020.png/440px-Ariana_Grande_Grammys_Red_Carpet_2020.png",
      hint: "Pop singer known for 'Thank U, Next'",
    },
    {
      name: "Morgan Freeman",
      aliases: ["morgan", "freeman"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Morgan_Freeman-crop.jpg/440px-Morgan_Freeman-crop.jpg",
      hint: "Iconic voice, starred in Shawshank Redemption",
    },
    {
      name: "Kim Kardashian",
      aliases: ["kim", "kardashian", "kim k"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Kim_Kardashian_West_2019.jpg/440px-Kim_Kardashian_West_2019.jpg",
      hint: "Reality TV star and business mogul",
    },
    {
      name: "Will Smith",
      aliases: ["will", "smith", "fresh prince"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/TechCrunch_Disrupt_2019_%2848834434641%29_%28cropped%29.jpg/440px-TechCrunch_Disrupt_2019_%2848834434641%29_%28cropped%29.jpg",
      hint: "Fresh Prince of Bel-Air star",
    },
    {
      name: "Selena Gomez",
      aliases: ["selena", "gomez"],
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Selena_Gomez_-_Walmart_3.jpg/440px-Selena_Gomez_-_Walmart_3.jpg",
      hint: "Singer, actress, and Rare Beauty founder",
    },
  ];

  const GRID_SIZE = 5; // 5x5 grid = 25 tiles
  const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
  const TILES_PER_REVEAL = 3;
  const MAX_POINTS = 500;
  const POINTS_PER_TILE = Math.floor(MAX_POINTS / TOTAL_TILES);
  const ROUNDS = 10;

  let currentRound = 0;
  let totalScore = 0;
  let tilesRemaining = TOTAL_TILES;
  let revealedTiles = new Set();
  let currentCelebrity = null;
  let gameOrder = [];
  let correctCount = 0;
  let skippedCount = 0;
  let wrongCount = 0;
  let hintShown = false;

  function init() {
    document.getElementById("reveal-btn").addEventListener("click", revealTiles);
    document.getElementById("guess-btn").addEventListener("click", submitGuess);
    document.getElementById("skip-btn").addEventListener("click", skipCelebrity);
    document.getElementById("next-btn").addEventListener("click", nextRound);
    document.getElementById("play-again-btn").addEventListener("click", startNewGame);

    document.getElementById("guess-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitGuess();
    });

    startNewGame();
  }

  function startNewGame() {
    currentRound = 0;
    totalScore = 0;
    correctCount = 0;
    skippedCount = 0;
    wrongCount = 0;

    // Shuffle and pick ROUNDS celebrities
    gameOrder = shuffleArray([...celebrities]).slice(0, ROUNDS);

    document.getElementById("game-over").classList.add("hidden");
    document.getElementById("total-score").textContent = "0";

    nextRound();
  }

  function nextRound() {
    if (currentRound >= gameOrder.length) {
      showGameOver();
      return;
    }

    currentCelebrity = gameOrder[currentRound];
    tilesRemaining = TOTAL_TILES;
    revealedTiles = new Set();
    hintShown = false;

    document.getElementById("result-overlay").classList.add("hidden");
    document.getElementById("round-number").textContent = `${currentRound + 1} / ${gameOrder.length}`;
    document.getElementById("tiles-left").textContent = TOTAL_TILES;
    document.getElementById("potential-points").textContent = MAX_POINTS;
    document.getElementById("guess-input").value = "";
    document.getElementById("hint-text").textContent = "Click \"Reveal Tiles\" to start!";
    document.getElementById("reveal-btn").disabled = false;
    document.getElementById("guess-btn").disabled = false;
    document.getElementById("skip-btn").disabled = false;
    document.getElementById("guess-input").disabled = false;

    // Load image
    const img = document.getElementById("celebrity-image");
    img.src = currentCelebrity.image;

    // Build tile grid
    buildTileGrid();

    currentRound++;
  }

  function buildTileGrid() {
    const grid = document.getElementById("tile-grid");
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${GRID_SIZE}, 1fr)`;

    for (let i = 0; i < TOTAL_TILES; i++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.index = i;
      grid.appendChild(tile);
    }
  }

  function revealTiles() {
    const unrevealed = [];
    for (let i = 0; i < TOTAL_TILES; i++) {
      if (!revealedTiles.has(i)) unrevealed.push(i);
    }

    if (unrevealed.length === 0) return;

    // Shuffle unrevealed and pick some
    const toReveal = shuffleArray(unrevealed).slice(0, TILES_PER_REVEAL);

    toReveal.forEach((index) => {
      revealedTiles.add(index);
      const tile = document.querySelector(`.tile[data-index="${index}"]`);
      if (tile) {
        tile.classList.add("revealed");
      }
    });

    tilesRemaining = TOTAL_TILES - revealedTiles.size;
    const potentialPoints = Math.max(0, MAX_POINTS - revealedTiles.size * POINTS_PER_REVEAL_COST);

    document.getElementById("tiles-left").textContent = tilesRemaining;
    document.getElementById("potential-points").textContent = potentialPoints;

    // Show hint after revealing half
    if (!hintShown && revealedTiles.size >= Math.floor(TOTAL_TILES / 2)) {
      document.getElementById("hint-text").textContent = currentCelebrity.hint;
      hintShown = true;
    } else if (!hintShown) {
      document.getElementById("hint-text").textContent = "Keep revealing to get a hint...";
    }

    // If all tiles revealed
    if (tilesRemaining === 0) {
      document.getElementById("reveal-btn").disabled = true;
    }
  }

  // Cost per tile revealed (in points)
  const POINTS_PER_REVEAL_COST = Math.floor(MAX_POINTS / (TOTAL_TILES / TILES_PER_REVEAL));

  function calculatePoints() {
    const revealedCount = revealedTiles.size;
    const revealRounds = Math.ceil(revealedCount / TILES_PER_REVEAL);
    return Math.max(0, MAX_POINTS - revealRounds * POINTS_PER_REVEAL_COST);
  }

  function submitGuess() {
    const input = document.getElementById("guess-input");
    const guess = input.value.trim().toLowerCase();

    if (!guess) return;

    const correctName = currentCelebrity.name.toLowerCase();
    const aliases = currentCelebrity.aliases.map((a) => a.toLowerCase());

    const isCorrect = guess === correctName || aliases.some((alias) => guess.includes(alias) || alias.includes(guess));

    if (isCorrect) {
      const points = calculatePoints();
      totalScore += points;
      correctCount++;
      showResult(true, points);
    } else {
      wrongCount++;
      showResult(false, 0);
    }
  }

  function skipCelebrity() {
    totalScore = Math.max(0, totalScore - 50);
    skippedCount++;
    showResult(false, -50, true);
  }

  function showResult(correct, points, skipped = false) {
    // Reveal all tiles
    for (let i = 0; i < TOTAL_TILES; i++) {
      const tile = document.querySelector(`.tile[data-index="${i}"]`);
      if (tile) tile.classList.add("revealed");
    }

    // Disable controls
    document.getElementById("reveal-btn").disabled = true;
    document.getElementById("guess-btn").disabled = true;
    document.getElementById("skip-btn").disabled = true;
    document.getElementById("guess-input").disabled = true;

    // Show result overlay
    const overlay = document.getElementById("result-overlay");
    overlay.classList.remove("hidden");

    if (correct) {
      document.getElementById("result-icon").textContent = "🎉";
      document.getElementById("result-title").textContent = "Correct!";
      document.getElementById("result-message").textContent = "Great job! You recognized them!";
      document.getElementById("result-points").textContent = `+${points} points`;
      document.getElementById("result-points").className = "result-points points-positive";
    } else if (skipped) {
      document.getElementById("result-icon").textContent = "⏭️";
      document.getElementById("result-title").textContent = "Skipped";
      document.getElementById("result-message").textContent = "Better luck with the next one!";
      document.getElementById("result-points").textContent = "-50 points";
      document.getElementById("result-points").className = "result-points points-negative";
    } else {
      document.getElementById("result-icon").textContent = "❌";
      document.getElementById("result-title").textContent = "Wrong!";
      document.getElementById("result-message").textContent = "That's not who it is.";
      document.getElementById("result-points").textContent = "+0 points";
      document.getElementById("result-points").className = "result-points";
    }

    document.getElementById("result-answer").textContent = currentCelebrity.name;
    document.getElementById("total-score").textContent = totalScore;

    // Update next button text
    const nextBtn = document.getElementById("next-btn");
    if (currentRound >= gameOrder.length) {
      nextBtn.textContent = "See Results";
    } else {
      nextBtn.textContent = "Next Celebrity";
    }

    // Award points if logged in
    if (correct && points > 0 && typeof Auth !== "undefined" && Auth.isLoggedIn()) {
      Auth.addPoints(points);
    }
  }

  function showGameOver() {
    document.getElementById("game-over").classList.remove("hidden");
    document.getElementById("final-score").textContent = totalScore;
    document.getElementById("correct-count").textContent = correctCount;
    document.getElementById("skipped-count").textContent = skippedCount;
    document.getElementById("wrong-count").textContent = wrongCount;
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", RevealGame.init);
