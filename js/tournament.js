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

  // Scoring config - fetched from server on init
  var SERVER_CONFIG = {
    basePointsPerQuestion: 6,
    decayPerSecond: 1,
    decayStartAfter: 0,
    minPoints: 0,
  };

  const GRID_SIZE = 4;
  const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
  const IMAGES_PER_ROUND = 10;
  const TIME_PER_IMAGE = 10;
  const MAX_ATTEMPTS = 10;

  let currentContest = null;
  let gameOrder = [];
  let gameAnswers = [];
  let currentImageIndex = 0;
  let score = 0;
  let diceValue = 0;
  let diceRolled = false;
  let timer = null;
  let timeLeft = TIME_PER_IMAGE;
  let questionStartTime = 0;
  let selectedOption = null;
  let revealedTiles = new Set();
  let autoRevealInterval = null;

  async function init() {
    // Fetch scoring config from server
    try {
      var config = await API.getGameConfig();
      if (config && config.scoring) {
        SERVER_CONFIG = config.scoring;
      }
    } catch (err) {
      console.warn("Failed to fetch game config, using defaults");
    }

    await renderContests();
  }

  async function renderContests() {
    var grid = document.getElementById("contest-grid");
    var now = new Date();
    var contests = [];

    // Try fetching from API
    try {
      if (API.isAuthenticated()) {
        contests = await API.getContests();
      }
    } catch (err) {
      console.warn("Failed to fetch contests from API:", err);
    }

    // If no contests from API, show message
    if (contests.length === 0) {
      grid.innerHTML = '<div class="contest-empty"><p>No active contests right now. Check back soon!</p></div>';
      document.getElementById("live-count").textContent = "0 contests running";
      return;
    }

    var liveCount = contests.filter(function(c) {
      return c.is_daily || (new Date(c.starts_at) <= now && new Date(c.ends_at) > now);
    }).length;
    document.getElementById("live-count").textContent = liveCount + " contest" + (liveCount !== 1 ? "s" : "") + " running";

    grid.innerHTML = contests.map(function(c) {
      var bestScore = c.my_best_score || 0;
      var attempts = c.my_attempts || 0;
      var playerCount = parseInt(c.player_count) || 0;
      var maxPlayers = c.max_players || 100;
      var fillPct = (playerCount / maxPlayers) * 100;

      var endsAt = new Date(c.ends_at);
      var startsAt = new Date(c.starts_at);
      var isActive = c.is_daily || (startsAt <= now && endsAt > now);
      var isUpcoming = startsAt > now;
      var isEnded = endsAt <= now;

      var timeStr = "";
      if (c.is_daily) {
        timeStr = "Ends at midnight";
      } else if (isActive) {
        var mins = Math.max(0, Math.floor((endsAt - now) / 60000));
        timeStr = "Ends in " + mins + " min";
      } else if (isUpcoming) {
        var hrs = Math.floor((startsAt - now) / 3600000);
        var m = Math.floor(((startsAt - now) % 3600000) / 60000);
        timeStr = hrs > 0 ? "Starts in " + hrs + "h " + m + "m" : "Starts in " + m + "m";
      } else {
        timeStr = "Ended";
      }

      var canPlay = isActive && !isEnded;
      var attemptsLeft = (c.max_attempts || MAX_ATTEMPTS) - attempts;

      return '<div class="contest-card ' + (c.type === "subscriber" ? "contest-premium" : "contest-free") + '">' +
        '<div class="contest-card-header">' +
          '<h3>' + c.name + '</h3>' +
          (c.type === "free" ? '<span class="contest-badge-free">FREE</span>' : "") +
          (c.type === "subscriber" && c.is_daily ? '<span class="contest-badge-daily">PRO</span>' : "") +
          (isActive && !c.is_daily ? '<span class="contest-badge-live"><span class="live-dot"></span> LIVE</span>' : "") +
          (isUpcoming ? '<span class="contest-badge-upcoming">UPCOMING</span>' : "") +
        '</div>' +
        '<div class="contest-details">' +
          '<div class="contest-detail"><span class="contest-detail-label">Prize Pool</span><span class="contest-detail-value prize">$' + parseFloat(c.prize_pool).toFixed(0) + '</span></div>' +
          '<div class="contest-detail"><span class="contest-detail-label">Players</span><span class="contest-detail-value">' + playerCount + '/' + maxPlayers + '</span></div>' +
          '<div class="contest-detail"><span class="contest-detail-label">Best Score</span><span class="contest-detail-value">' + (bestScore > 0 ? bestScore : "-") + '</span></div>' +
          '<div class="contest-detail"><span class="contest-detail-label">Attempts</span><span class="contest-detail-value">' + attempts + '/' + (c.max_attempts || MAX_ATTEMPTS) + '</span></div>' +
        '</div>' +
        '<div class="contest-footer">' +
          '<span class="contest-time">' + timeStr + '</span>' +
          (canPlay && attemptsLeft > 0
            ? '<button class="btn btn-primary contest-join-btn" onclick="Tournament.joinContest(' + c.id + ')">' + (attempts > 0 ? "Replay" : "Join") + '</button>'
            : attemptsLeft <= 0
              ? '<span class="contest-maxed">Max attempts</span>'
              : '<button class="btn btn-outline contest-join-btn" disabled>Not Active</button>'
          ) +
        '</div>' +
        '<div class="contest-progress-bar"><div class="contest-progress-fill" style="width: ' + fillPct + '%"></div></div>' +
      '</div>';
    }).join("");
  }

  function joinContest(contestId) {
    if (!Auth.isLoggedIn()) {
      Auth.showModal("signup");
      return;
    }

    // Check subscription for non-free contests
    var user = Auth.currentUser();
    // Find the contest to check type
    // For now, just try to play - server will reject if subscription needed
    currentContest = { id: contestId };
    startTournamentGame();
  }

  function startTournamentGame() {
    gameOrder = shuffleArray([...celebrities]).slice(0, IMAGES_PER_ROUND);
    gameAnswers = [];
    currentImageIndex = 0;
    score = 0;

    document.getElementById("tournament-modal").classList.remove("hidden");
    document.getElementById("tm-gameover").classList.add("hidden");
    document.body.style.overflow = "hidden";

    switchTab("game");
    loadImage();
  }

  // ===== DICE MECHANIC =====
  async function rollDice() {
    if (diceRolled) return;
    diceRolled = true;

    // Get dice value from server
    var serverDice;
    try {
      serverDice = await API.rollDice();
    } catch (err) {
      console.warn("Server dice failed, using local:", err);
    }

    var diceEl = document.getElementById("tm-dice");
    var faceEl = document.getElementById("tm-dice-face");
    diceEl.classList.add("tm-dice-rolling");

    var rollCount = 0;
    var rollInterval = setInterval(function() {
      faceEl.textContent = getDiceFace(Math.floor(Math.random() * 6) + 1);
      rollCount++;
      if (rollCount > 12) {
        clearInterval(rollInterval);
        diceValue = serverDice || (Math.floor(Math.random() * 6) + 1);
        faceEl.textContent = getDiceFace(diceValue);
        diceEl.classList.remove("tm-dice-rolling");
        diceEl.classList.add("tm-dice-landed");

        var maxBasePts = SERVER_CONFIG.basePointsPerQuestion;
        var maxTotalPts = diceValue * maxBasePts;
        document.getElementById("tm-dice-mult").textContent = diceValue;
        document.getElementById("tm-dice-base").textContent = maxBasePts + " pt";
        document.getElementById("tm-dice-total").textContent = maxTotalPts + " Pts";
        document.getElementById("tm-image-pts").textContent = maxTotalPts + " Pts";

        questionStartTime = performance.now();
        startAutoReveal();
        startTimer();
      }
    }, 80);
  }

  function getDiceFace(val) {
    var faces = { 1: "\u2680", 2: "\u2681", 3: "\u2682", 4: "\u2683", 5: "\u2684", 6: "\u2685" };
    return faces[val] || "?";
  }

  async function loadImage() {
    if (currentImageIndex >= gameOrder.length) {
      endTournament();
      return;
    }

    var celeb = gameOrder[currentImageIndex];
    selectedOption = null;
    revealedTiles = new Set();
    diceRolled = false;
    diceValue = 0;
    timeLeft = TIME_PER_IMAGE;

    var diceEl = document.getElementById("tm-dice");
    diceEl.classList.remove("tm-dice-landed", "tm-dice-rolling");
    document.getElementById("tm-dice-face").textContent = "?";
    document.getElementById("tm-dice-mult").textContent = "?";
    document.getElementById("tm-dice-total").textContent = "? Pts";
    document.getElementById("tm-dice-base").textContent = SERVER_CONFIG.basePointsPerQuestion + " pt";

    document.getElementById("tm-round").textContent = "Image " + (currentImageIndex + 1) + "/" + IMAGES_PER_ROUND;
    document.getElementById("tm-image-label").textContent = "Image " + (currentImageIndex + 1);
    document.getElementById("tm-image-pts").textContent = "? Pts";
    document.getElementById("tm-score").textContent = score + " Score";
    document.getElementById("tm-timer").textContent = TIME_PER_IMAGE + "s";
    document.getElementById("tm-timer").classList.remove("tm-timer-danger");
    document.getElementById("tm-progress").style.width = "100%";
    document.getElementById("tm-submit").disabled = true;

    buildTileGrid();

    var options = shuffleArray([...celeb.options]);
    var optionsEl = document.getElementById("tm-options");
    optionsEl.innerHTML = options.map(function(opt, i) {
      return '<button class="tm-option" onclick="Tournament.selectOption(this, \'' + opt.replace(/'/g, "\\'") + '\')" data-option="' + i + '">' +
        '<span class="tm-option-radio"></span><span>' + opt + '</span></button>';
    }).join("");

    var img = document.getElementById("tm-image");
    var imageUrl = await fetchWikiImage(celeb.wiki);
    if (imageUrl) {
      await new Promise(function(resolve) {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = imageUrl;
      });
    }

    setTimeout(rollDice, 500);
  }

  async function fetchWikiImage(wikiTitle) {
    try {
      var apiUrl = "https://en.wikipedia.org/w/api.php?action=query&titles=" + wikiTitle + "&prop=pageimages&format=json&pithumbsize=500&origin=*";
      var res = await fetch(apiUrl);
      if (res.ok) {
        var data = await res.json();
        var pages = data.query.pages;
        var page = Object.values(pages)[0];
        if (page && page.thumbnail && page.thumbnail.source) return page.thumbnail.source;
      }
    } catch (e) {}
    return null;
  }

  function buildTileGrid() {
    var grid = document.getElementById("tm-tile-grid");
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = "repeat(" + GRID_SIZE + ", 1fr)";
    grid.style.gridTemplateRows = "repeat(" + GRID_SIZE + ", 1fr)";
    for (var i = 0; i < TOTAL_TILES; i++) {
      var tile = document.createElement("div");
      tile.className = "tm-tile";
      tile.dataset.index = i;
      grid.appendChild(tile);
    }
  }

  function startAutoReveal() {
    clearInterval(autoRevealInterval);
    var revealDelay = (TIME_PER_IMAGE * 1000) / (TOTAL_TILES + 2);
    autoRevealInterval = setInterval(function() {
      var unrevealed = [];
      for (var i = 0; i < TOTAL_TILES; i++) {
        if (!revealedTiles.has(i)) unrevealed.push(i);
      }
      if (unrevealed.length === 0) { clearInterval(autoRevealInterval); return; }
      var idx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      revealedTiles.add(idx);
      var tile = document.querySelector('.tm-tile[data-index="' + idx + '"]');
      if (tile) tile.classList.add("tm-tile-revealed");
    }, revealDelay);
  }

  function getElapsedSeconds() {
    return Math.floor((performance.now() - questionStartTime) / 1000);
  }

  function calculateDecayedPoints() {
    var elapsed = getElapsedSeconds();
    var effectiveElapsed = Math.max(0, elapsed - SERVER_CONFIG.decayStartAfter);
    var decayed = SERVER_CONFIG.basePointsPerQuestion - (effectiveElapsed * SERVER_CONFIG.decayPerSecond);
    return Math.max(SERVER_CONFIG.minPoints, decayed);
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(function() {
      timeLeft--;
      document.getElementById("tm-timer").textContent = timeLeft + "s";
      document.getElementById("tm-progress").style.width = ((timeLeft / TIME_PER_IMAGE) * 100) + "%";

      if (diceValue > 0) {
        var currentBase = calculateDecayedPoints();
        var currentTotal = diceValue * currentBase;
        document.getElementById("tm-dice-base").textContent = currentBase + " pt";
        document.getElementById("tm-dice-total").textContent = currentTotal + " Pts";
        document.getElementById("tm-image-pts").textContent = currentTotal + " Pts";
        var totalEl = document.getElementById("tm-dice-total");
        if (currentBase <= 2) { totalEl.classList.add("tm-pts-low"); totalEl.classList.remove("tm-pts-mid"); }
        else if (currentBase <= 4) { totalEl.classList.add("tm-pts-mid"); totalEl.classList.remove("tm-pts-low"); }
        else { totalEl.classList.remove("tm-pts-mid", "tm-pts-low"); }
      }

      if (timeLeft <= 3) document.getElementById("tm-timer").classList.add("tm-timer-danger");
      else document.getElementById("tm-timer").classList.remove("tm-timer-danger");

      if (timeLeft <= 0) {
        clearInterval(timer);
        clearInterval(autoRevealInterval);
        revealAllTiles();
        gameAnswers.push({ question: currentImageIndex, answer: null, correct: false, points: 0, dice: diceValue, elapsed: TIME_PER_IMAGE });
        document.getElementById("tm-image-pts").textContent = "+0 Pts";
        setTimeout(function() { currentImageIndex++; loadImage(); }, 1500);
      }
    }, 1000);
  }

  function selectOption(el, option) {
    document.querySelectorAll(".tm-option").forEach(function(o) { o.classList.remove("selected"); });
    el.classList.add("selected");
    selectedOption = option;
    document.getElementById("tm-submit").disabled = false;
  }

  function submitAnswer() {
    if (!selectedOption) return;
    clearInterval(timer);
    clearInterval(autoRevealInterval);

    var celeb = gameOrder[currentImageIndex];
    var correct = selectedOption === celeb.name;
    var elapsed = getElapsedSeconds();

    document.querySelectorAll(".tm-option").forEach(function(opt) {
      opt.disabled = true;
      var optText = opt.querySelector("span:last-child").textContent;
      if (optText === celeb.name) opt.classList.add("tm-option-correct");
      else if (opt.classList.contains("selected") && !correct) opt.classList.add("tm-option-wrong");
    });

    var points = 0;
    if (correct) {
      var decayedBase = calculateDecayedPoints();
      points = diceValue * decayedBase;
      score += points;
      document.getElementById("tm-image-pts").textContent = "+" + points + " Pts! (" + elapsed + "s)";
    } else {
      document.getElementById("tm-image-pts").textContent = "+0 Pts";
    }

    gameAnswers.push({
      question: currentImageIndex,
      answer: selectedOption,
      correct_answer: celeb.name,
      correct: correct,
      points: points,
      dice: diceValue,
      elapsed: elapsed,
    });

    document.getElementById("tm-score").textContent = score + " Score";
    document.getElementById("tm-submit").disabled = true;
    revealAllTiles();

    setTimeout(function() { currentImageIndex++; loadImage(); }, 2000);
  }

  function revealAllTiles() {
    for (var i = 0; i < TOTAL_TILES; i++) {
      var tile = document.querySelector('.tm-tile[data-index="' + i + '"]');
      if (tile) tile.classList.add("tm-tile-revealed");
    }
  }

  async function endTournament() {
    clearInterval(timer);
    clearInterval(autoRevealInterval);

    // Submit score to server
    var result = null;
    try {
      result = await API.submitContest(currentContest.id, score, gameAnswers);
    } catch (err) {
      console.warn("Failed to submit score to server:", err);
      // Show error but still display results
    }

    // Fetch real leaderboard
    await renderLeaderboardFromAPI();

    // Refresh user profile (points may have changed)
    try { await Auth.addPoints(0); } catch (e) {}

    document.getElementById("tm-gameover").classList.remove("hidden");
    document.getElementById("tm-final-score").textContent = score;

    if (result) {
      document.getElementById("tm-best-score").textContent = result.best_score;
      document.getElementById("tm-attempts-used").textContent = result.attempts;
      var attemptsLeft = (result.max_attempts || MAX_ATTEMPTS) - result.attempts;
      var replayBtn = document.getElementById("tm-replay-btn");

      if (attemptsLeft > 0) {
        replayBtn.classList.remove("hidden");
        replayBtn.textContent = "Replay (" + attemptsLeft + " left)";
      } else {
        replayBtn.classList.add("hidden");
      }

      if (result.improvement > 0) {
        document.getElementById("tm-final-msg").textContent = "New best! +" + result.improvement + " pts earned!";
      } else if (attemptsLeft > 0) {
        document.getElementById("tm-final-msg").textContent = "Replay to improve your score!";
      } else {
        document.getElementById("tm-final-msg").textContent = "All attempts used. Check the leaderboard!";
      }
    } else {
      document.getElementById("tm-best-score").textContent = score;
      document.getElementById("tm-attempts-used").textContent = "?";
      document.getElementById("tm-final-msg").textContent = "Score recorded locally. Server sync pending.";
      document.getElementById("tm-replay-btn").classList.remove("hidden");
      document.getElementById("tm-replay-btn").textContent = "Replay";
    }
  }

  async function renderLeaderboardFromAPI() {
    try {
      var data = await API.getLeaderboard(currentContest.id);
      var leaderboard = data.leaderboard || [];
      var myRank = data.my_rank || "-";
      var user = Auth.currentUser();
      var myName = user ? user.username : "You";

      document.getElementById("tm-my-rank").querySelector(".tm-rank-num").textContent = myRank + ".";
      document.getElementById("tm-my-score").textContent = score;

      var rankingsEl = document.getElementById("tm-rankings");
      if (leaderboard.length > 0) {
        rankingsEl.innerHTML = leaderboard.map(function(p, i) {
          var isMe = p.username === myName;
          return '<div class="tm-rank-row ' + (isMe ? "tm-rank-me" : "") + '">' +
            '<span class="tm-rank-num">' + (i + 1) + '.</span>' +
            '<span class="tm-rank-avatar">&#128100;</span>' +
            '<span class="tm-rank-name">' + (isMe ? "My Rank" : p.username) + '</span>' +
            '<span class="tm-rank-score">' + p.best_score + '</span>' +
          '</div>';
        }).join("");
      } else {
        rankingsEl.innerHTML = '<div class="tm-rank-row"><span class="tm-rank-name">No scores yet</span></div>';
      }
    } catch (err) {
      console.warn("Failed to fetch leaderboard:", err);
    }
  }

  function replay() {
    startTournamentGame();
  }

  function viewLeaderboard() {
    document.getElementById("tm-gameover").classList.add("hidden");
    renderLeaderboardFromAPI();
    switchTab("leaderboard");
  }

  function closeGame() {
    clearInterval(timer);
    clearInterval(autoRevealInterval);
    document.getElementById("tournament-modal").classList.add("hidden");
    document.body.style.overflow = "";
    renderContests();
  }

  function switchTab(tab) {
    document.querySelectorAll(".tm-tab").forEach(function(t) {
      t.classList.toggle("active", t.dataset.tab === tab);
    });
    document.getElementById("tab-game").classList.toggle("hidden", tab !== "game");
    document.getElementById("tab-leaderboard").classList.toggle("hidden", tab !== "leaderboard");
    document.getElementById("tab-winnings").classList.toggle("hidden", tab !== "winnings");
  }

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
    }
    return arr;
  }

  document.addEventListener("DOMContentLoaded", init);

  return { joinContest: joinContest, selectOption: selectOption, submitAnswer: submitAnswer, closeGame: closeGame, switchTab: switchTab, viewLeaderboard: viewLeaderboard, replay: replay };
})();
