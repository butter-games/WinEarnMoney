const Tournament = (() => {
  // Celebrity data with multiple choice options
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

  // --- Server-controlled config (change these to tune scoring) ---
  const SERVER_CONFIG = {
    basePointsPerQuestion: 6,  // Max fixed points per question (before decay)
    decayPerSecond: 1,         // Points lost per second of elapsed time
    decayStartAfter: 0,        // Seconds before decay begins (0 = immediate)
    minPoints: 0,              // Minimum fixed points (floor after decay)
    // Final score per question = dice_roll(1-6) × max(minPoints, basePoints - (elapsed_seconds × decayPerSecond))
    // Example with defaults: answer at 2s → dice × (6 - 2×1) = dice × 4
    //                        answer at 5s → dice × (6 - 5×1) = dice × 1
    //                        answer at 6s+ → dice × 0
  };

  const GRID_SIZE = 4;
  const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
  const IMAGES_PER_ROUND = 10;
  const TIME_PER_IMAGE = 10;
  const MAX_ATTEMPTS = 10;
  const CONTEST_HISTORY_KEY = "wem_contest_history";

  let currentContest = null;
  let gameOrder = [];
  let currentImageIndex = 0;
  let score = 0;
  let diceValue = 0;
  let diceRolled = false;
  let timer = null;
  let timeLeft = TIME_PER_IMAGE;
  let questionStartTime = 0; // timestamp when timer starts (after dice roll)
  let selectedOption = null;
  let revealedTiles = new Set();
  let autoRevealInterval = null;
  let botPlayers = [];

  // Generate hourly contest schedule for today
  function generateContests() {
    const now = new Date();
    const hours = [9, 12, 15, 18]; // 4 hourly contests at 9am, 12pm, 3pm, 6pm
    const contests = [];

    // Free Daily Contest (available to all users)
    contests.push({
      id: "free-daily",
      name: "Free Daily Contest",
      entry: "Free",
      prize: "$10",
      type: "free",
      maxPlayers: 500,
      playersJoined: 120 + Math.floor(Math.random() * 200),
      endsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59),
      isDaily: true,
    });

    // Daily Champs League (subscribers)
    contests.push({
      id: "daily",
      name: "Daily Champs League",
      entry: "Subscriber",
      prize: "$50",
      type: "subscriber",
      maxPlayers: 200,
      playersJoined: 47 + Math.floor(Math.random() * 100),
      endsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59),
      isDaily: true,
    });

    // 4 hourly contests (subscribers)
    hours.forEach((h, i) => {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const active = now >= start && now < end;
      const upcoming = now < start;

      contests.push({
        id: `hourly-${i}`,
        name: `Hourly Contest #${i + 1}`,
        entry: "Subscriber",
        prize: "$25",
        type: "subscriber",
        maxPlayers: 100,
        playersJoined: active ? 15 + Math.floor(Math.random() * 60) : 0,
        endsAt: end,
        startsAt: start,
        isActive: active,
        isUpcoming: upcoming,
      });
    });

    return contests;
  }

  function init() {
    renderContests();
  }

  function renderContests() {
    const contests = generateContests();
    const now = new Date();
    const grid = document.getElementById("contest-grid");

    const liveCount = contests.filter((c) => {
      if (c.isDaily) return true;
      return c.isActive;
    }).length;
    document.getElementById("live-count").textContent = `${liveCount} contest${liveCount !== 1 ? "s" : ""} running`;

    grid.innerHTML = contests.map((c) => {
      const history = getContestHistory(c.id);
      const bestScore = history.bestScore || 0;
      const attempts = history.attempts || 0;
      const fillPct = (c.playersJoined / c.maxPlayers) * 100;

      let timeStr = "";
      if (c.isDaily) {
        timeStr = "Ends at midnight";
      } else if (c.isActive) {
        const mins = Math.max(0, Math.floor((c.endsAt - now) / 60000));
        timeStr = `Ends in ${mins} min`;
      } else if (c.isUpcoming) {
        const hrs = Math.floor((c.startsAt - now) / 3600000);
        const mins = Math.floor(((c.startsAt - now) % 3600000) / 60000);
        timeStr = hrs > 0 ? `Starts in ${hrs}h ${mins}m` : `Starts in ${mins}m`;
      } else {
        timeStr = "Ended";
      }

      const canPlay = c.isDaily || c.isActive;
      const attemptsLeft = MAX_ATTEMPTS - attempts;

      return `
        <div class="contest-card ${c.type === 'subscriber' ? 'contest-premium' : 'contest-free'}">
          <div class="contest-card-header">
            <h3>${c.name}</h3>
            ${c.type === 'free' ? '<span class="contest-badge-free">FREE</span>' : ""}
            ${c.type === 'subscriber' && c.isDaily ? '<span class="contest-badge-daily">PRO</span>' : ""}
            ${c.isActive ? '<span class="contest-badge-live"><span class="live-dot"></span> LIVE</span>' : ""}
            ${c.isUpcoming ? '<span class="contest-badge-upcoming">UPCOMING</span>' : ""}
          </div>
          <div class="contest-details">
            <div class="contest-detail">
              <span class="contest-detail-label">Prize Pool</span>
              <span class="contest-detail-value prize">${c.prize}</span>
            </div>
            <div class="contest-detail">
              <span class="contest-detail-label">Players</span>
              <span class="contest-detail-value">${c.playersJoined}/${c.maxPlayers}</span>
            </div>
            <div class="contest-detail">
              <span class="contest-detail-label">Best Score</span>
              <span class="contest-detail-value">${bestScore > 0 ? bestScore : "-"}</span>
            </div>
            <div class="contest-detail">
              <span class="contest-detail-label">Attempts</span>
              <span class="contest-detail-value">${attempts}/${MAX_ATTEMPTS}</span>
            </div>
          </div>
          <div class="contest-footer">
            <span class="contest-time">${timeStr}</span>
            ${canPlay && attemptsLeft > 0
              ? `<button class="btn btn-primary contest-join-btn" onclick="Tournament.joinContest('${c.id}')">${attempts > 0 ? "Replay" : "Join"}</button>`
              : attemptsLeft <= 0
                ? `<span class="contest-maxed">Max attempts</span>`
                : `<button class="btn btn-outline contest-join-btn" disabled>Not Active</button>`
            }
          </div>
          <div class="contest-progress-bar">
            <div class="contest-progress-fill" style="width: ${fillPct}%"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  function getContestHistory(contestId) {
    const all = JSON.parse(localStorage.getItem(CONTEST_HISTORY_KEY) || "{}");
    return all[contestId] || { attempts: 0, bestScore: 0, scores: [] };
  }

  function saveContestHistory(contestId, score) {
    const all = JSON.parse(localStorage.getItem(CONTEST_HISTORY_KEY) || "{}");
    if (!all[contestId]) all[contestId] = { attempts: 0, bestScore: 0, scores: [] };
    all[contestId].attempts++;
    all[contestId].scores.push(score);
    all[contestId].bestScore = Math.max(all[contestId].bestScore, score);
    localStorage.setItem(CONTEST_HISTORY_KEY, JSON.stringify(all));
    return all[contestId];
  }

  function joinContest(contestId) {
    if (!Auth.isLoggedIn()) {
      Auth.showModal("signup");
      return;
    }

    // Check subscription
    const user = Auth.currentUser();
    if (!user.subscribed) {
      document.getElementById("sub-prompt").classList.remove("hidden");
      return;
    }

    // Check attempts
    const history = getContestHistory(contestId);
    if (history.attempts >= MAX_ATTEMPTS) return;

    currentContest = { id: contestId };
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
      "NightOwl", "EagleEye", "PixelPro", "VictoryLap", "ThunderBolt",
    ];
    return shuffleArray(names).slice(0, 19).map((name) => ({
      name,
      score: 0,
      // Simulate dice-based final scores (avg dice ~3.5 × 10 questions × pointsPerQ × ~70% accuracy)
      finalScore: Math.floor(Math.random() * 30) + 5,
    }));
  }

  // ===== DICE MECHANIC =====
  async function rollDice() {
    if (diceRolled) return;
    diceRolled = true;

    // Get dice value from server (prevents cheating)
    var serverDice;
    try {
      if (typeof API !== "undefined" && API.isAuthenticated()) {
        serverDice = await API.rollDice();
      }
    } catch (err) {
      console.warn("Server dice failed, using local:", err);
    }

    const diceEl = document.getElementById("tm-dice");
    const faceEl = document.getElementById("tm-dice-face");

    diceEl.classList.add("tm-dice-rolling");

    // Animate through random values
    let rollCount = 0;
    const rollInterval = setInterval(() => {
      faceEl.textContent = getDiceFace(Math.floor(Math.random() * 6) + 1);
      rollCount++;
      if (rollCount > 12) {
        clearInterval(rollInterval);
        // Use server dice value if available, otherwise local
        diceValue = serverDice || (Math.floor(Math.random() * 6) + 1);
        faceEl.textContent = getDiceFace(diceValue);
        diceEl.classList.remove("tm-dice-rolling");
        diceEl.classList.add("tm-dice-landed");

        // Update dice info - show max possible (answering instantly)
        const maxBasePts = SERVER_CONFIG.basePointsPerQuestion;
        const maxTotalPts = diceValue * maxBasePts;
        document.getElementById("tm-dice-mult").textContent = diceValue;
        document.getElementById("tm-dice-base").textContent = `${maxBasePts} pt`;
        document.getElementById("tm-dice-total").textContent = `${maxTotalPts} Pts`;
        document.getElementById("tm-image-pts").textContent = `${maxTotalPts} Pts`;

        // Now start the timer, reveal, and track start time
        questionStartTime = performance.now();
        startAutoReveal();
        startTimer();
      }
    }, 80);
  }

  function getDiceFace(val) {
    const faces = { 1: "\u2680", 2: "\u2681", 3: "\u2682", 4: "\u2683", 5: "\u2684", 6: "\u2685" };
    return faces[val] || "?";
  }

  async function loadImage() {
    if (currentImageIndex >= gameOrder.length) {
      endTournament();
      return;
    }

    const celeb = gameOrder[currentImageIndex];
    selectedOption = null;
    revealedTiles = new Set();
    diceRolled = false;
    diceValue = 0;
    timeLeft = TIME_PER_IMAGE;

    // Reset dice UI
    const diceEl = document.getElementById("tm-dice");
    diceEl.classList.remove("tm-dice-landed", "tm-dice-rolling");
    document.getElementById("tm-dice-face").textContent = "?";
    document.getElementById("tm-dice-mult").textContent = "?";
    document.getElementById("tm-dice-total").textContent = "? Pts";
    document.getElementById("tm-dice-base").textContent = `${SERVER_CONFIG.pointsPerQuestion} pt`;

    // Update UI
    document.getElementById("tm-round").textContent = `Image ${currentImageIndex + 1}/${IMAGES_PER_ROUND}`;
    document.getElementById("tm-image-label").textContent = `Image ${currentImageIndex + 1}`;
    document.getElementById("tm-image-pts").textContent = "? Pts";
    document.getElementById("tm-score").textContent = `${score} Score`;
    document.getElementById("tm-timer").textContent = `${TIME_PER_IMAGE}s`;
    document.getElementById("tm-timer").classList.remove("tm-timer-danger");
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

    // Auto-roll dice after short delay
    setTimeout(rollDice, 500);
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

  function getElapsedSeconds() {
    return Math.floor((performance.now() - questionStartTime) / 1000);
  }

  function calculateDecayedPoints() {
    const elapsed = getElapsedSeconds();
    const effectiveElapsed = Math.max(0, elapsed - SERVER_CONFIG.decayStartAfter);
    const decayed = SERVER_CONFIG.basePointsPerQuestion - (effectiveElapsed * SERVER_CONFIG.decayPerSecond);
    return Math.max(SERVER_CONFIG.minPoints, decayed);
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
      timeLeft--;
      document.getElementById("tm-timer").textContent = `${timeLeft}s`;
      document.getElementById("tm-progress").style.width = `${(timeLeft / TIME_PER_IMAGE) * 100}%`;

      // Update decaying points display in real-time
      if (diceValue > 0) {
        const currentBase = calculateDecayedPoints();
        const currentTotal = diceValue * currentBase;
        document.getElementById("tm-dice-base").textContent = `${currentBase} pt`;
        document.getElementById("tm-dice-total").textContent = `${currentTotal} Pts`;
        document.getElementById("tm-image-pts").textContent = `${currentTotal} Pts`;

        // Color change as points decay
        if (currentBase <= 2) {
          document.getElementById("tm-dice-total").classList.add("tm-pts-low");
        } else if (currentBase <= 4) {
          document.getElementById("tm-dice-total").classList.add("tm-pts-mid");
          document.getElementById("tm-dice-total").classList.remove("tm-pts-low");
        } else {
          document.getElementById("tm-dice-total").classList.remove("tm-pts-mid", "tm-pts-low");
        }
      }

      if (timeLeft <= 3) {
        document.getElementById("tm-timer").classList.add("tm-timer-danger");
      } else {
        document.getElementById("tm-timer").classList.remove("tm-timer-danger");
      }

      if (timeLeft <= 0) {
        clearInterval(timer);
        clearInterval(autoRevealInterval);
        revealAllTiles();
        updateBotScores();
        // Time's up - 0 points, auto advance
        document.getElementById("tm-image-pts").textContent = "+0 Pts";
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
      // SCORING: dice_value × decayed_base_points
      // decayed_base = basePointsPerQuestion - (elapsed_seconds × decayPerSecond)
      const decayedBase = calculateDecayedPoints();
      const points = diceValue * decayedBase;
      score += points;
      const elapsed = getElapsedSeconds();
      document.getElementById("tm-image-pts").textContent = `+${points} Pts! (${elapsed}s)`;
    } else {
      // Wrong answer = 0 points regardless of dice
      document.getElementById("tm-image-pts").textContent = "+0 Pts";
    }

    document.getElementById("tm-score").textContent = `${score} Score`;
    document.getElementById("tm-submit").disabled = true;

    revealAllTiles();
    updateBotScores();

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
    const myBest = currentContest ? getContestHistory(currentContest.id).bestScore : 0;
    const displayScore = Math.max(score, myBest);

    const allPlayers = [
      { name: Auth.isLoggedIn() ? Auth.currentUser().name : "You", score: displayScore, isMe: true },
      ...botPlayers,
    ].sort((a, b) => b.score - a.score);

    const myRank = allPlayers.findIndex((p) => p.isMe) + 1;
    document.getElementById("tm-my-rank").querySelector(".tm-rank-num").textContent = `${myRank}.`;
    document.getElementById("tm-my-score").textContent = displayScore;

    const rankingsEl = document.getElementById("tm-rankings");
    rankingsEl.innerHTML = allPlayers.slice(0, 10).map((p, i) => `
      <div class="tm-rank-row ${p.isMe ? "tm-rank-me" : ""}">
        <span class="tm-rank-num">${i + 1}.</span>
        <span class="tm-rank-avatar">&#128100;</span>
        <span class="tm-rank-name">${p.isMe ? "My Rank" : p.name}</span>
        <span class="tm-rank-score">${p.score}</span>
      </div>
    `).join("");
  }

  function endTournament() {
    clearInterval(timer);
    clearInterval(autoRevealInterval);

    // Save score and get updated history
    const history = saveContestHistory(currentContest.id, score);

    updateBotScores();

    document.getElementById("tm-gameover").classList.remove("hidden");
    document.getElementById("tm-final-score").textContent = score;
    document.getElementById("tm-best-score").textContent = history.bestScore;
    document.getElementById("tm-attempts-used").textContent = history.attempts;

    const attemptsLeft = MAX_ATTEMPTS - history.attempts;
    const replayBtn = document.getElementById("tm-replay-btn");

    if (attemptsLeft > 0) {
      replayBtn.classList.remove("hidden");
      replayBtn.textContent = `Replay (${attemptsLeft} left)`;
    } else {
      replayBtn.classList.add("hidden");
    }

    if (score >= history.bestScore && score > 0) {
      document.getElementById("tm-final-msg").textContent = "New best score! Can you do even better?";
    } else if (attemptsLeft > 0) {
      document.getElementById("tm-final-msg").textContent = "Replay to improve your score!";
    } else {
      document.getElementById("tm-final-msg").textContent = "All attempts used. Check the leaderboard!";
    }

    // Award points (only for improvement over previous best)
    if (Auth.isLoggedIn() && score > 0) {
      const previousBest = history.scores.length > 1
        ? Math.max(...history.scores.slice(0, -1))
        : 0;
      const improvement = Math.max(0, score - previousBest);
      if (improvement > 0) {
        Auth.addPoints(improvement, Ledger.TYPES.TOURNAMENT_WIN, `Tournament score improvement (+${improvement} pts)`);
      }
    }
  }

  function replay() {
    const history = getContestHistory(currentContest.id);
    if (history.attempts >= MAX_ATTEMPTS) return;
    startTournamentGame();
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
    renderContests(); // Refresh contest list with updated attempts
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

  return { joinContest, selectOption, submitAnswer, closeGame, switchTab, viewLeaderboard, replay };
})();
