// API client for PlayRealMoneyGames backend
window.API = (() => {
  const BASE_URL = "https://api.playrealmoneygames.com";
  const TOKEN_KEY = "wem_token";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  async function request(method, path, body) {
    var headers = { "Content-Type": "application/json" };
    var token = getToken();
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    var options = { method: method, headers: headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    var res = await fetch(BASE_URL + path, options);
    var data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

  // Auth
  async function signup(username, email, password, referralCode) {
    var body = { username: username, email: email, password: password };
    if (referralCode) body.referral_code = referralCode;
    var data = await request("POST", "/api/auth/signup", body);
    setToken(data.token);
    return data.user;
  }

  async function login(email, password) {
    var data = await request("POST", "/api/auth/login", { email: email, password: password });
    setToken(data.token);
    return data.user;
  }

  async function getReferrals() {
    var data = await request("GET", "/api/auth/referrals");
    return data;
  }

  async function getProfile() {
    var data = await request("GET", "/api/auth/me");
    return data.user;
  }

  function logout() {
    clearToken();
  }

  function isAuthenticated() {
    return !!getToken();
  }

  // Game
  async function getGameConfig() {
    var data = await request("GET", "/api/game/config");
    return data.config;
  }

  async function rollDice() {
    var data = await request("POST", "/api/game/dice");
    return data.dice;
  }

  async function submitRevealGame(category, score, correctCount, totalRounds) {
    var data = await request("POST", "/api/game/reveal/submit", {
      category: category, score: score, correct_count: correctCount, total_rounds: totalRounds,
    });
    return data;
  }

  async function getContests() {
    var data = await request("GET", "/api/game/contests");
    return data.contests;
  }

  async function submitContest(contestId, score, answers) {
    var data = await request("POST", "/api/game/contests/" + contestId + "/submit", { score: score, answers: answers });
    return data;
  }

  async function getLeaderboard(contestId) {
    var data = await request("GET", "/api/game/contests/" + contestId + "/leaderboard");
    return data;
  }

  // Wallet
  async function getBalance() {
    var data = await request("GET", "/api/wallet/balance");
    return data;
  }

  async function getLedger(filters) {
    var query = "";
    if (filters) {
      var params = [];
      if (filters.type) params.push("type=" + filters.type);
      if (filters.from) params.push("from=" + filters.from);
      if (filters.to) params.push("to=" + filters.to);
      if (filters.limit) params.push("limit=" + filters.limit);
      if (filters.offset) params.push("offset=" + filters.offset);
      if (params.length) query = "?" + params.join("&");
    }
    var data = await request("GET", "/api/wallet/ledger" + query);
    return data;
  }

  async function withdraw(amount, method, accountDetails) {
    var data = await request("POST", "/api/wallet/withdraw", {
      amount: amount,
      method: method,
      account_details: accountDetails,
    });
    return data;
  }

  async function getWithdrawals() {
    var data = await request("GET", "/api/wallet/withdrawals");
    return data.withdrawals;
  }

  return {
    signup: signup,
    login: login,
    getProfile: getProfile,
    getReferrals: getReferrals,
    submitRevealGame: submitRevealGame,
    logout: logout,
    isAuthenticated: isAuthenticated,
    getGameConfig: getGameConfig,
    rollDice: rollDice,
    getContests: getContests,
    submitContest: submitContest,
    getLeaderboard: getLeaderboard,
    getBalance: getBalance,
    getLedger: getLedger,
    withdraw: withdraw,
    getWithdrawals: getWithdrawals,
  };
})();
