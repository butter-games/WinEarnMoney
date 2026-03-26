const Tournament = (() => {
  // Celebrity data with wrong answer options for multiple choice
  const celebrities = [
    { name: "Dwayne Johnson", wiki: "Dwayne_Johnson", options: ["Vin Diesel", "Dwayne Johnson", "John Cena", "Jason Statham"] },
    { name: "Taylor Swift", wiki: "Taylor_Swift", options: ["Ariana Grande", "Selena Gomez", "Taylor Swift", "Billie Eilish"] },
    { name: "Leonardo DiCaprio", wiki: "Leonardo_DiCaprio", options: ["Leonardo DiCaprio", "Brad Pitt", "Tom Hardy", "Matt Damon"] },
    { name: "Beyonce", wiki: "Beyonc%C3%A9", options: ["Rihanna", "Beyonce", "Nicki Minaj", "Cardi B"] },
    { name: "Cristiano Ronaldo", wiki: "Cristiano_Ronaldo", options: ["Neymar", "Kylian Mbappe", "Cristiano Ronaldo", "Lionel Messi"] },
    { name: "Oprah Winfrey", wiki: "Oprah_Winfrey", options: ["Oprah Winfrey", "Whoopi Goldberg", "Ellen DeGeneres", "Tyra Banks"] },
    { name: "Tom Cruise", wiki: "Tom_Cruise", options: ["Tom Hanks", "Tom Cruise", "Chris Pratt", "Mark Wahlberg"] },
    { name: "Elon Musk", wiki: "Elon_Musk", options: ["Jeff Bezos", "Mark Zuckerberg", "Elon Musk", "Bill Gates"] },
    { name: "Rihanna", wiki: "Rihanna", options: ["Rihanna", "Beyonce", "SZA", "Dua Lipa"] },
    { name: "Lionel Messi", wiki: "Lionel_Messi", options: ["Lionel Messi", "Cristiano Ronaldo", "Luis Suarez", "Antoine Griezmann"] },
    { name: "Ariana Grande", wiki: "Ariana_Grande", options: ["Demi Lovato", "Ariana Grande", "Camila Cabello", "Dua Lipa"] },
    { name: "Morgan Freeman", wiki: "Morgan_Freeman", options: ["Denzel Washington", "Samuel L. Jackson", "Morgan Freeman", "Idris Elba"] },
    { name: "Kim Kardashian", wiki: "Kim_Kardashian", options: ["Kylie Jenner", "Kim Kardashian", "Khloe Kardashian", "Kourtney Kardashian"] },
    { name: "Will Smith", wiki: "Will_Smith", options: ["Will Smith", "Jamie Foxx", "Martin Lawrence", "Kevin Hart"] },
    { name: "Selena Gomez", wiki: "Selena_Gomez", options: ["Demi Lovato", "Miley Cyrus", "Selena Gomez", "Zendaya"] },
  ];

  const GRID_SIZE = 4; // 4x4 grid = 16 tiles
  const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
  const IMAGES_PER_ROUND = 10;
  const TIME_PER_IMAGE = 10;
  const POINTS_PER_CORRECT = 6;

  let currentContest = null;
  let gameOrder = [];
  let currentImageIndex = 0;
  let score = 0;
  let timer = null;
  let timeLeft = TIME_PER_IMAGE;
  let selectedOption = null;
  let revealedTiles = new Set();
  let autoRevealInterval = null;
  let botPlayers = [];

  // Contest definitions
  const contests = [
    { id: 1, name: "Champs League", entry: "Free", prize: "$50", players: "47/100", time: "Ends in 45 min", type: "free", maxPlayers: 100 },
    { id: 2, name: "Pro Challenge", entry: "$0.99", prize: "$100", players: "23/50", time: "Ends in 30 min", type: "paid", maxPlayers: 50 },
    { id: 3, name: "Mega Contest", entry: "$1.99", prize: "$250", players: "89/200", time: "Ends in 1 hr", type: "subscriber", maxPlayers: 200 },
    { id: 4, name: "Quick Fire", entry: "Free", prize: "$25", players: "15/30", time: "Ends in 15 min", type: "free", maxPlayers: 30 },
  ];

  function init() {
    renderContests();
  }

  function renderContests() {
    const grid = document.getElementById("contest-grid");
    grid.innerHTML = contests.map((c) => `
      <div class="contest-card ${c.type === 'subscriber' ? 'contest-premium' : ''}">
        <div class="contest-card-header">
          <h3>${c.name}</h3>
          ${c.type === 'subscriber' ? '<span class="contest-lock">PRO</span>' : ''}
        </div>
        <div class="contest-details">
          <div class="contest-detail">
            <span class="contest-detail-label">Entry</span>
            <span class="contest-detail-value">${c.entry}</span>
          </div>
          <div class="contest-detail">
            <span class="contest-detail-label">Prize Pool</span>
            <span class="contest-detail-value prize">${c.prize}</span>
          </div>
          <div class="contest-detail">
            <span class="contest-detail-label">Players</span>
            <span class="contest-detail-value">${c.players}</span>
          </div>
        </div>
        <div class="contest-footer">
          <span class="contest-time">${c.time}</span>
          <button class="btn btn-primary contest-join-btn" onclick="Tournament.joinContest(${c.id})">Join</button>
        </div>
        <div class="contest-progress-bar">
          <div class="contest-progress-fill" style="width: ${parseInt(c.players) / c.maxPlayers * 100}%"></div>
        </div>
      </div>
    `).join("");
  }

  function joinContest(contestId) {
    if (!Auth.isLoggedIn()) {
      Auth.showModal("signup");
      return;
    }

    const contest = contests.find((c) => c.id === contestId);
    if (!contest) return;

    // Check subscription for premium contests
    if (contest.type === "subscriber") {
      const user = Auth.currentUser();
      if (!user.subscribed) {
        document.getElementById("sub-prompt").classList.remove("hidden");
        return;
      }
    }

    currentContest = contest;
    startTournamentGame();
  }

  function startTournamentGame() {
    gameOrder = shuffleArray([...celebrities]).slice(0, IMAGES_PER_ROUND);
    currentImageIndex = 0;
    score = 0;
    botPlayers = generateBotPlayers();

    document.getElementById("tournament-modal").classList.remove("hidden");
    document.getElementById("tm-gameover").classList.add("hidden");
    document.body.style.overflow = "hidden";

    switchTab("game");
    loadImage();
  }

  function generateBotPlayers() {
    const names = [
      "CryptoKing99", "LuckyAce", "GameMaster", "QuizWhiz", "StarPlayer",
      "SwiftGuess", "ProGamer22", "PointsHunter", "TopScorer", "QuickDraw",
      "BrainStorm", "TriviaKing", "SmartPlay", "GoldRush", "ChampX",
      "NightOwl", "EagleEye", "PixelPro", "VictoryLap", "ThunderBolt"
    ];
    return shuffleArray(names).slice(0, 19).map((name) => ({
      name,
      score: 0,
      finalScore: Math.floor(Math.random() * 45) + 15,
    }));
  }

  async function loadImage() {
    if (currentImageIndex >= gameOrder.length) {
      endTournament();
      return;
    }

    const celeb = gameOrder[currentImageIndex];
    selectedOption = null;
    revealedTiles = new Set();
    timeLeft = TIME_PER_IMAGE;

    // Update UI
    document.getElementById("tm-round").textContent = `Image ${currentImageIndex + 1}/${IMAGES_PER_ROUND}`;
    document.getElementById("tm-image-label").textContent = `Image ${currentImageIndex + 1}`;
    document.getElementById("tm-image-pts").textContent = `${POINTS_PER_CORRECT} Pts`;
    document.getElementById("tm-score").textContent = `${score} Score`;
    document.getElementById("tm-timer").textContent = `${TIME_PER_IMAGE}s`;
    document.getElementById("tm-progress").style.width = "100%";
    document.getElementById("tm-submit").disabled = true;

    // Build tile grid
    buildTileGrid();

    // Render options (shuffled)
    const options = shuffleArray([...celeb.options]);
    const optionsEl = document.getElementById("tm-options");
    optionsEl.innerHTML = options.map((opt, i) => `
      <button class="tm-option" onclick="Tournament.selectOption(this, '${opt.replace(/'/g, "\\'")}')" data-option="${i}">
        <span class="tm-option-radio"></span>
        <span>${opt}</span>
      </button>
    `).join("");

    // Load image
    const img = document.getElementById("tm-image");
    const imageUrl = await fetchWikiImage(celeb.wiki);
    if (imageUrl) {
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = imageUrl;
      });
    }

    // Start auto-reveal and timer
    startAutoReveal();
    startTimer();
  }

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
      console.warn("Image fetch failed for", wikiTitle);
    }
    return null;
  }

  function buildTileGrid() {
    const grid = document.getElementById("tm-tile-grid");
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${GRID_SIZE}, 1fr)`;

    for (let i = 0; i < TOTAL_TILES; i++) {
      const tile = document.createElement("div");
      tile.className = "tm-tile";
      tile.dataset.index = i;
      grid.appendChild(tile);
    }
  }

  function startAutoReveal() {
    clearInterval(autoRevealInterval);
    let revealCount = 0;
    const revealDelay = (TIME_PER_IMAGE * 1000) / (TOTAL_TILES + 2);

    autoRevealInterval = setInterval(() => {
      const unrevealed = [];
      for (let i = 0; i < TOTAL_TILES; i++) {
        if (!revealedTiles.has(i)) unrevealed.push(i);
      }
      if (unrevealed.length === 0) {
        clearInterval(autoRevealInterval);
        return;
      }
      const idx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      revealedTiles.add(idx);
      const tile = document.querySelector(`.tm-tile[data-index="${idx}"]`);
      if (tile) tile.classList.add("tm-tile-revealed");
    }, revealDelay);
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
      timeLeft--;
      document.getElementById("tm-timer").textContent = `${timeLeft}s`;
      document.getElementById("tm-progress").style.width = `${(timeLeft / TIME_PER_IMAGE) * 100}%`;

      if (timeLeft <= 3) {
        document.getElementById("tm-timer").classList.add("tm-timer-danger");
      } else {
        document.getElementById("tm-timer").classList.remove("tm-timer-danger");
      }

      if (timeLeft <= 0) {
        clearInterval(timer);
        clearInterval(autoRevealInterval);
        // Time's up - auto advance
        revealAllTiles();
        updateBotScores();
        setTimeout(() => {
          currentImageIndex++;
          loadImage();
        }, 1500);
      }
    }, 1000);
  }

  function selectOption(el, option) {
    document.querySelectorAll(".tm-option").forEach((o) => o.classList.remove("selected"));
    el.classList.add("selected");
    selectedOption = option;
    document.getElementById("tm-submit").disabled = false;
  }

  function submitAnswer() {
    if (!selectedOption) return;

    clearInterval(timer);
    clearInterval(autoRevealInterval);

    const celeb = gameOrder[currentImageIndex];
    const correct = selectedOption === celeb.name;

    // Highlight correct/wrong
    document.querySelectorAll(".tm-option").forEach((opt) => {
      opt.disabled = true;
      const optText = opt.querySelector("span:last-child").textContent;
      if (optText === celeb.name) {
        opt.classList.add("tm-option-correct");
      } else if (opt.classList.contains("selected") && !correct) {
        opt.classList.add("tm-option-wrong");
      }
    });

    if (correct) {
      // Bonus points based on time remaining
      const timeBonus = Math.floor(timeLeft / 2);
      const points = POINTS_PER_CORRECT + timeBonus;
      score += points;
      document.getElementById("tm-image-pts").textContent = `+${points} Pts!`;
    } else {
      document.getElementById("tm-image-pts").textContent = "+0 Pts";
    }

    document.getElementById("tm-score").textContent = `${score} Score`;
    document.getElementById("tm-submit").disabled = true;

    revealAllTiles();
    updateBotScores();

    // Next image after delay
    setTimeout(() => {
      currentImageIndex++;
      loadImage();
    }, 2000);
  }

  function revealAllTiles() {
    for (let i = 0; i < TOTAL_TILES; i++) {
      const tile = document.querySelector(`.tm-tile[data-index="${i}"]`);
      if (tile) tile.classList.add("tm-tile-revealed");
    }
  }

  function updateBotScores() {
    botPlayers.forEach((bot) => {
      const progress = (currentImageIndex + 1) / IMAGES_PER_ROUND;
      bot.score = Math.floor(bot.finalScore * progress * (0.8 + Math.random() * 0.4));
    });
    renderLeaderboard();
  }

  function renderLeaderboard() {
    const allPlayers = [
      { name: Auth.isLoggedIn() ? Auth.currentUser().name : "You", score: score, isMe: true },
      ...botPlayers,
    ].sort((a, b) => b.score - a.score);

    const myRank = allPlayers.findIndex((p) => p.isMe) + 1;
    document.getElementById("tm-my-rank").querySelector(".tm-rank-num").textContent = `${myRank}.`;
    document.getElementById("tm-my-score").textContent = score;

    const rankingsEl = document.getElementById("tm-rankings");
    rankingsEl.innerHTML = allPlayers.slice(0, 10).map((p, i) => `
      <div class="tm-rank-row ${p.isMe ? 'tm-rank-me' : ''}">
        <span class="tm-rank-num">${i + 1}.</span>
        <span class="tm-rank-avatar">&#128100;</span>
        <span class="tm-rank-name">${p.isMe ? 'My Rank' : p.name}</span>
        <span class="tm-rank-score">${p.score}</span>
      </div>
    `).join("");
  }

  function endTournament() {
    clearInterval(timer);
    clearInterval(autoRevealInterval);

    updateBotScores();

    document.getElementById("tm-gameover").classList.remove("hidden");
    document.getElementById("tm-final-score").textContent = score;

    const allPlayers = [
      { name: "You", score: score, isMe: true },
      ...botPlayers,
    ].sort((a, b) => b.score - a.score);
    const rank = allPlayers.findIndex((p) => p.isMe) + 1;

    if (rank <= 3) {
      document.getElementById("tm-final-msg").textContent = `Amazing! You finished #${rank} - prize incoming!`;
    } else if (rank <= 10) {
      document.getElementById("tm-final-msg").textContent = `Good game! You finished #${rank}.`;
    } else {
      document.getElementById("tm-final-msg").textContent = `You finished #${rank}. Keep practicing!`;
    }

    // Award points
    if (Auth.isLoggedIn() && score > 0) {
      Auth.addPoints(score);
    }
  }

  function viewLeaderboard() {
    document.getElementById("tm-gameover").classList.add("hidden");
    switchTab("leaderboard");
  }

  function closeGame() {
    clearInterval(timer);
    clearInterval(autoRevealInterval);
    document.getElementById("tournament-modal").classList.add("hidden");
    document.body.style.overflow = "";
  }

  function switchTab(tab) {
    document.querySelectorAll(".tm-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === tab);
    });
    document.getElementById("tab-game").classList.toggle("hidden", tab !== "game");
    document.getElementById("tab-leaderboard").classList.toggle("hidden", tab !== "leaderboard");
    document.getElementById("tab-winnings").classList.toggle("hidden", tab !== "winnings");
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  document.addEventListener("DOMContentLoaded", init);

  return { joinContest, selectOption, submitAnswer, closeGame, switchTab, viewLeaderboard };
})();
