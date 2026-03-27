// Centralized ledger system for tracking all financial events
const Ledger = (() => {
  const LEDGER_KEY = "wem_ledger";

  // Transaction types
  const TYPES = {
    GAME_WIN: "game_win",
    TOURNAMENT_WIN: "tournament_win",
    WITHDRAWAL: "withdrawal",
    SUBSCRIPTION: "subscription",
    SIGNUP_BONUS: "signup_bonus",
    REFUND: "refund",
  };

  function getAll() {
    return JSON.parse(localStorage.getItem(LEDGER_KEY) || "[]");
  }

  function save(entries) {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(entries));
  }

  /**
   * Add a ledger entry
   * @param {string} type - One of TYPES
   * @param {number} amount - Points (positive = earned, negative = spent/withdrawn)
   * @param {string} description - Human-readable description
   * @param {object} meta - Optional metadata (game name, contest id, etc.)
   */
  function addEntry(type, amount, description, meta = {}) {
    const entries = getAll();
    const entry = {
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      type,
      amount,
      description,
      meta,
      date: new Date().toISOString(),
      balanceAfter: getCurrentBalance() + amount,
    };
    entries.unshift(entry);
    save(entries);
    return entry;
  }

  function getCurrentBalance() {
    if (typeof Auth !== "undefined" && Auth.isLoggedIn()) {
      const user = Auth.currentUser();
      return user ? user.points || 0 : 0;
    }
    return 0;
  }

  // Get filtered entries
  function getFiltered(filters = {}) {
    let entries = getAll();

    if (filters.type) {
      entries = entries.filter((e) => e.type === filters.type);
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      entries = entries.filter((e) => new Date(e.date).getTime() >= from);
    }

    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime() + 86400000; // end of day
      entries = entries.filter((e) => new Date(e.date).getTime() <= to);
    }

    if (filters.amountType === "earned") {
      entries = entries.filter((e) => e.amount > 0);
    } else if (filters.amountType === "spent") {
      entries = entries.filter((e) => e.amount < 0);
    }

    return entries;
  }

  // Summary stats
  function getSummary() {
    const entries = getAll();
    const totalEarned = entries.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
    const totalSpent = entries.filter((e) => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const gameWins = entries.filter((e) => e.type === TYPES.GAME_WIN).length;
    const tournamentWins = entries.filter((e) => e.type === TYPES.TOURNAMENT_WIN).length;
    const withdrawals = entries.filter((e) => e.type === TYPES.WITHDRAWAL).length;

    return { totalEarned, totalSpent, gameWins, tournamentWins, withdrawals, totalTransactions: entries.length };
  }

  return { TYPES, addEntry, getAll, getFiltered, getSummary };
})();
