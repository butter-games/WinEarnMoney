const RevealGame = (() => {
  const GRID_SIZE = 5;
  const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
  const TILES_PER_REVEAL = 3;
  const MAX_POINTS = 500;
  const ROUNDS = 10;

  let currentRound = 0;
  let totalScore = 0;
  let tilesRemaining = TOTAL_TILES;
  let revealedTiles = new Set();
  let currentItem = null;
  let gameOrder = [];
  let correctCount = 0;
  let skippedCount = 0;
  let wrongCount = 0;
  let hintShown = false;
  let category = null;

  async function fetchWikiImage(wikiTitle) {
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
    // Determine category from URL param
    const params = new URLSearchParams(window.location.search);
    const catId = params.get("category") || "celebrities";

    if (typeof GameCategories !== "undefined" && GameCategories[catId]) {
      category = GameCategories[catId];
    } else {
      category = GameCategories ? GameCategories.celebrities : null;
    }

    if (category) {
      document.getElementById("category-title").textContent = category.title;
      document.getElementById("category-desc").textContent =
        `Guess the ${category.itemLabel.toLowerCase()} behind the tiles. The fewer tiles you reveal, the more points you earn!`;
      document.title = `Reveal ${category.title} - WinEarnMoney`;
    }

    document.getElementById("reveal-btn").addEventListener("click", revealTiles);
    document.getElementById("guess-btn").addEventListener("click", submitGuess);
    document.getElementById("skip-btn").addEventListener("click", skipItem);
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

    const data = category ? category.data : [];
    gameOrder = shuffleArray([...data]).slice(0, ROUNDS);

    document.getElementById("game-over").classList.add("hidden");
    document.getElementById("total-score").textContent = "0";

    nextRound();
  }

  async function nextRound() {
    if (currentRound >= gameOrder.length) {
      showGameOver();
      return;
    }

    currentItem = gameOrder[currentRound];
    tilesRemaining = TOTAL_TILES;
    revealedTiles = new Set();
    hintShown = false;

    document.getElementById("result-overlay").classList.add("hidden");
    document.getElementById("round-number").textContent = `${currentRound + 1} / ${gameOrder.length}`;
    document.getElementById("tiles-left").textContent = TOTAL_TILES;
    document.getElementById("potential-points").textContent = MAX_POINTS;
    document.getElementById("guess-input").value = "";
    document.getElementById("guess-input").placeholder = `Type ${(category ? category.itemLabel : "answer").toLowerCase()} name...`;
    document.getElementById("hint-text").textContent = "Loading image...";
    document.getElementById("reveal-btn").disabled = true;
    document.getElementById("guess-btn").disabled = true;
    document.getElementById("skip-btn").disabled = true;
    document.getElementById("guess-input").disabled = true;

    buildTileGrid();

    const img = document.getElementById("celebrity-image");
    img.style.background = "";
    const imageUrl = await fetchWikiImage(currentItem.wiki);

    if (imageUrl) {
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = () => {
          showFallbackImage(img);
          resolve();
        };
        img.src = imageUrl;
      });
    } else {
      showFallbackImage(img);
    }

    document.getElementById("hint-text").textContent = 'Click "Reveal Tiles" to start!';
    document.getElementById("reveal-btn").disabled = false;
    document.getElementById("guess-btn").disabled = false;
    document.getElementById("skip-btn").disabled = false;
    document.getElementById("guess-input").disabled = false;

    currentRound++;
  }

  function showFallbackImage(imgEl) {
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

    const toReveal = shuffleArray(unrevealed).slice(0, TILES_PER_REVEAL);

    toReveal.forEach((index) => {
      revealedTiles.add(index);
      const tile = document.querySelector(`.tile[data-index="${index}"]`);
      if (tile) tile.classList.add("revealed");
    });

    tilesRemaining = TOTAL_TILES - revealedTiles.size;
    document.getElementById("tiles-left").textContent = tilesRemaining;
    document.getElementById("potential-points").textContent = calculatePoints();

    if (!hintShown && revealedTiles.size >= Math.floor(TOTAL_TILES / 2)) {
      document.getElementById("hint-text").textContent = currentItem.hint;
      hintShown = true;
    } else if (!hintShown) {
      document.getElementById("hint-text").textContent = "Keep revealing to get a hint...";
    }

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

    const correctName = currentItem.name.toLowerCase();
    const aliases = currentItem.aliases.map((a) => a.toLowerCase());

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

  function skipItem() {
    totalScore = Math.max(0, totalScore - 50);
    skippedCount++;
    showResult(false, -50, true);
  }

  function showResult(correct, points, skipped = false) {
    for (let i = 0; i < TOTAL_TILES; i++) {
      const tile = document.querySelector(`.tile[data-index="${i}"]`);
      if (tile) tile.classList.add("revealed");
    }

    document.getElementById("reveal-btn").disabled = true;
    document.getElementById("guess-btn").disabled = true;
    document.getElementById("skip-btn").disabled = true;
    document.getElementById("guess-input").disabled = true;

    const overlay = document.getElementById("result-overlay");
    overlay.classList.remove("hidden");

    const itemLabel = category ? category.itemLabel : "answer";

    if (correct) {
      document.getElementById("result-icon").textContent = "\uD83C\uDF89";
      document.getElementById("result-title").textContent = "Correct!";
      document.getElementById("result-message").textContent = "Great job! You got it!";
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
      document.getElementById("result-message").textContent = `That's not the right ${itemLabel.toLowerCase()}.`;
      document.getElementById("result-points").textContent = "+0 points";
      document.getElementById("result-points").className = "result-points";
    }

    document.getElementById("result-answer").textContent = currentItem.name;
    document.getElementById("total-score").textContent = totalScore;

    const nextBtn = document.getElementById("next-btn");
    nextBtn.textContent = currentRound >= gameOrder.length ? "See Results" : `Next ${itemLabel}`;

  }

  async function showGameOver() {
    document.getElementById("game-over").classList.remove("hidden");
    document.getElementById("final-score").textContent = totalScore;
    document.getElementById("correct-count").textContent = correctCount;
    document.getElementById("skipped-count").textContent = skippedCount;
    document.getElementById("wrong-count").textContent = wrongCount;

    // Submit total score to server
    if (totalScore > 0 && typeof API !== "undefined" && API.isAuthenticated()) {
      try {
        var catName = category ? category.title : "Game";
        await API.submitRevealGame(catName, totalScore, correctCount, gameOrder.length);
        Auth.addPoints(0); // refresh profile
      } catch (err) {
        console.warn("Failed to submit reveal score:", err);
      }
    }
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
