const RevealGame = (() => {
  // Celebrity data - images fetched from Wikipedia API at runtime
  const celebrities = [
    {
      name: "Dwayne Johnson",
      aliases: ["the rock", "dwayne", "rock"],
      wiki: "Dwayne_Johnson",
      hint: "Known for wrestling and action movies",
    },
    {
      name: "Taylor Swift",
      aliases: ["taylor", "swift"],
      wiki: "Taylor_Swift",
      hint: "Pop superstar who started in country music",
    },
    {
      name: "Leonardo DiCaprio",
      aliases: ["leonardo", "dicaprio", "leo dicaprio"],
      wiki: "Leonardo_DiCaprio",
      hint: "Oscar winner, starred in Titanic",
    },
    {
      name: "Beyonce",
      aliases: ["beyonce", "beyoncé", "queen bey"],
      wiki: "Beyonc%C3%A9",
      hint: "Former Destiny's Child member, 'Single Ladies' singer",
    },
    {
      name: "Cristiano Ronaldo",
      aliases: ["ronaldo", "cristiano", "cr7"],
      wiki: "Cristiano_Ronaldo",
      hint: "Portuguese soccer legend, known as CR7",
    },
    {
      name: "Oprah Winfrey",
      aliases: ["oprah", "winfrey"],
      wiki: "Oprah_Winfrey",
      hint: "Talk show queen turned media mogul",
    },
    {
      name: "Tom Cruise",
      aliases: ["cruise", "tom"],
      wiki: "Tom_Cruise",
      hint: "Mission Impossible star, known for doing own stunts",
    },
    {
      name: "Elon Musk",
      aliases: ["elon", "musk"],
      wiki: "Elon_Musk",
      hint: "CEO of Tesla and SpaceX",
    },
    {
      name: "Rihanna",
      aliases: ["rihanna", "riri"],
      wiki: "Rihanna",
      hint: "Barbadian singer and Fenty Beauty founder",
    },
    {
      name: "Lionel Messi",
      aliases: ["messi", "lionel", "leo messi"],
      wiki: "Lionel_Messi",
      hint: "Argentine soccer star, World Cup winner 2022",
    },
    {
      name: "Ariana Grande",
      aliases: ["ariana", "grande"],
      wiki: "Ariana_Grande",
      hint: "Pop singer known for 'Thank U, Next'",
    },
    {
      name: "Morgan Freeman",
      aliases: ["morgan", "freeman"],
      wiki: "Morgan_Freeman",
      hint: "Iconic voice, starred in Shawshank Redemption",
    },
    {
      name: "Kim Kardashian",
      aliases: ["kim", "kardashian", "kim k"],
      wiki: "Kim_Kardashian",
      hint: "Reality TV star and business mogul",
    },
    {
      name: "Will Smith",
      aliases: ["will", "smith", "fresh prince"],
      wiki: "Will_Smith",
      hint: "Fresh Prince of Bel-Air star",
    },
    {
      name: "Selena Gomez",
      aliases: ["selena", "gomez"],
      wiki: "Selena_Gomez",
      hint: "Singer, actress, and Rare Beauty founder",
    },
  ];

  const GRID_SIZE = 5; // 5x5 grid = 25 tiles
  const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
  const TILES_PER_REVEAL = 3;
  const MAX_POINTS = 500;
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

  // Fetch image URL from Wikipedia MediaWiki API (CORS-friendly with origin=*)
  async function fetchWikiImage(wikiTitle) {
    // Method 1: MediaWiki API with explicit CORS support
    try {
      const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${wikiTitle}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        const pages = data.query.pages;
        const page = Object.values(pages)[0];
        if (page && page.thumbnail && page.thumbnail.source) {
          return page.thumbnail.source;
        }
      }
    } catch (e) {
      console.warn("MediaWiki API failed for", wikiTitle, e);
    }

    // Method 2: REST API fallback
    try {
      const restUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`;
      const res = await fetch(restUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.thumbnail && data.thumbnail.source) {
          return data.thumbnail.source.replace(/\/\d+px-/, "/500px-");
        }
      }
    } catch (e) {
      console.warn("REST API failed for", wikiTitle, e);
    }

    return null;
  }

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

  async function nextRound() {
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
    document.getElementById("hint-text").textContent = "Loading image...";
    document.getElementById("reveal-btn").disabled = true;
    document.getElementById("guess-btn").disabled = true;
    document.getElementById("skip-btn").disabled = true;
    document.getElementById("guess-input").disabled = true;

    // Build tile grid first (covers the image area)
    buildTileGrid();

    // Fetch and load image from Wikipedia
    const img = document.getElementById("celebrity-image");
    img.style.background = "";
    const imageUrl = await fetchWikiImage(currentCelebrity.wiki);

    if (imageUrl) {
      // Set handlers before src to catch the load event
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = () => {
          console.warn("Image failed to load:", imageUrl);
          showFallbackImage(img);
          resolve();
        };
        img.src = imageUrl;
      });
    } else {
      showFallbackImage(img);
    }

    function showFallbackImage(imgEl) {
      // Draw a placeholder on a canvas and use as image source
      const canvas = document.createElement("canvas");
      canvas.width = 500;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      const hue = Math.floor(Math.random() * 360);
      const gradient = ctx.createLinearGradient(0, 0, 500, 500);
      gradient.addColorStop(0, `hsl(${hue}, 50%, 25%)`);
      gradient.addColorStop(1, `hsl(${(hue + 60) % 360}, 50%, 15%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 500, 500);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = "bold 80px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", 250, 250);
      imgEl.src = canvas.toDataURL();
    }

    // Enable controls after image loads
    document.getElementById("hint-text").textContent = 'Click "Reveal Tiles" to start!';
    document.getElementById("reveal-btn").disabled = false;
    document.getElementById("guess-btn").disabled = false;
    document.getElementById("skip-btn").disabled = false;
    document.getElementById("guess-input").disabled = false;

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
    const potentialPoints = calculatePoints();

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

  function calculatePoints() {
    const revealedCount = revealedTiles.size;
    const revealRounds = Math.ceil(revealedCount / TILES_PER_REVEAL);
    const totalRevealRounds = Math.ceil(TOTAL_TILES / TILES_PER_REVEAL);
    const costPerRound = Math.floor(MAX_POINTS / totalRevealRounds);
    return Math.max(0, MAX_POINTS - revealRounds * costPerRound);
  }

  function submitGuess() {
    const input = document.getElementById("guess-input");
    const guess = input.value.trim().toLowerCase();

    if (!guess) return;

    const correctName = currentCelebrity.name.toLowerCase();
    const aliases = currentCelebrity.aliases.map((a) => a.toLowerCase());

    const isCorrect =
      guess === correctName || aliases.some((alias) => guess.includes(alias) || alias.includes(guess));

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
      document.getElementById("result-icon").textContent = "\uD83C\uDF89";
      document.getElementById("result-title").textContent = "Correct!";
      document.getElementById("result-message").textContent = "Great job! You recognized them!";
      document.getElementById("result-points").textContent = `+${points} points`;
      document.getElementById("result-points").className = "result-points points-positive";
    } else if (skipped) {
      document.getElementById("result-icon").textContent = "\u23ED\uFE0F";
      document.getElementById("result-title").textContent = "Skipped";
      document.getElementById("result-message").textContent = "Better luck with the next one!";
      document.getElementById("result-points").textContent = "-50 points";
      document.getElementById("result-points").className = "result-points points-negative";
    } else {
      document.getElementById("result-icon").textContent = "\u274C";
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
