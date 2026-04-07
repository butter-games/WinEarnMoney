const express = require("express");
const pool = require("../db/pool");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

// Admin check middleware
async function adminRequired(req, res, next) {
  try {
    const result = await pool.query("SELECT email FROM users WHERE id = $1", [req.userId]);
    const user = result.rows[0];
    // Add admin emails here
    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",") : [];
    if (!user || !adminEmails.includes(user.email)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}

// GET /api/admin/dashboard - Overview stats
router.get("/dashboard", authRequired, adminRequired, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE subscribed = true) as subscribers,
        (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
        (SELECT COALESCE(SUM(amount), 0) FROM ledger WHERE type = 'game_win') as total_game_points,
        (SELECT COALESCE(SUM(amount), 0) FROM ledger WHERE type = 'tournament_win') as total_tournament_points,
        (SELECT COUNT(*) FROM withdrawals) as total_withdrawals,
        (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'processing') as pending_withdrawals,
        (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'completed') as completed_withdrawals,
        (SELECT COUNT(*) FROM contests WHERE ends_at > NOW()) as active_contests,
        (SELECT COUNT(*) FROM contest_attempts) as total_attempts
    `);

    res.json({ stats: stats.rows[0] });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/users - List users
router.get("/users", authRequired, adminRequired, async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    let query = `SELECT id, username, email, points, games_played, subscribed,
                        subscription_plan, total_withdrawn, created_at
                 FROM users`;
    const params = [];

    if (search) {
      query += " WHERE username ILIKE $1 OR email ILIKE $1";
      params.push("%" + search + "%");
    }

    query += " ORDER BY created_at DESC LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2);
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    const countResult = await pool.query("SELECT COUNT(*) FROM users");

    res.json({ users: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error("Users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/users/:id - Update user
router.patch("/users/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const { points, subscribed, subscription_plan } = req.body;
    const userId = parseInt(req.params.id);
    const updates = [];
    const params = [];
    let idx = 1;

    if (points !== undefined) { updates.push("points = $" + idx++); params.push(points); }
    if (subscribed !== undefined) { updates.push("subscribed = $" + idx++); params.push(subscribed); }
    if (subscription_plan !== undefined) { updates.push("subscription_plan = $" + idx++); params.push(subscription_plan); }

    if (updates.length === 0) return res.status(400).json({ error: "No updates provided" });

    updates.push("updated_at = NOW()");
    params.push(userId);

    const result = await pool.query(
      "UPDATE users SET " + updates.join(", ") + " WHERE id = $" + idx + " RETURNING id, username, email, points, subscribed",
      params
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/contests - List contests with seed user counts
router.get("/contests", authRequired, adminRequired, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM contest_leaderboard cl WHERE cl.contest_id = c.id) as real_player_count,
        (SELECT COUNT(*) FROM contest_seed_users cs WHERE cs.contest_id = c.id) as seed_player_count,
        (SELECT COUNT(*) FROM contest_attempts ca WHERE ca.contest_id = c.id) as total_attempts
      FROM contests c ORDER BY c.starts_at DESC LIMIT 50
    `);
    res.json({ contests: result.rows });
  } catch (err) {
    console.error("Contests error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/contests - Create contest
router.post("/contests", authRequired, adminRequired, async (req, res) => {
  try {
    const { name, type, prize_pool, max_players, max_attempts, min_score_for_points, starts_at, ends_at, is_daily } = req.body;
    const result = await pool.query(
      `INSERT INTO contests (name, type, prize_pool, max_players, max_attempts, min_score_for_points, starts_at, ends_at, is_daily)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, type, prize_pool || 0, max_players || 100, max_attempts || 10, min_score_for_points || 0, starts_at, ends_at, is_daily || false]
    );
    res.status(201).json({ contest: result.rows[0] });
  } catch (err) {
    console.error("Create contest error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/contests/:id - Update contest
router.patch("/contests/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const { max_players, min_score_for_points, max_attempts, prize_pool, name } = req.body;
    const contestId = parseInt(req.params.id);
    const updates = [];
    const params = [];
    let idx = 1;

    if (max_players !== undefined) { updates.push("max_players = $" + idx++); params.push(max_players); }
    if (min_score_for_points !== undefined) { updates.push("min_score_for_points = $" + idx++); params.push(min_score_for_points); }
    if (max_attempts !== undefined) { updates.push("max_attempts = $" + idx++); params.push(max_attempts); }
    if (prize_pool !== undefined) { updates.push("prize_pool = $" + idx++); params.push(prize_pool); }
    if (name !== undefined) { updates.push("name = $" + idx++); params.push(name); }

    if (updates.length === 0) return res.status(400).json({ error: "No updates provided" });

    params.push(contestId);
    const result = await pool.query(
      "UPDATE contests SET " + updates.join(", ") + " WHERE id = $" + idx + " RETURNING *",
      params
    );

    res.json({ contest: result.rows[0] });
  } catch (err) {
    console.error("Update contest error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/contests/:id/seeds - Get seed users for a contest
router.get("/contests/:id/seeds", authRequired, adminRequired, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM contest_seed_users WHERE contest_id = $1 ORDER BY score DESC",
      [parseInt(req.params.id)]
    );
    res.json({ seeds: result.rows });
  } catch (err) {
    console.error("Seeds error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/contests/:id/seeds - Add seed users to a contest
router.post("/contests/:id/seeds", authRequired, adminRequired, async (req, res) => {
  try {
    const contestId = parseInt(req.params.id);
    const { seeds } = req.body; // Array of { username, score }

    if (!Array.isArray(seeds) || seeds.length === 0) {
      return res.status(400).json({ error: "Seeds must be an array of { username, score }" });
    }

    const values = [];
    const params = [];
    let idx = 1;

    for (const seed of seeds) {
      values.push("($" + idx++ + ", $" + idx++ + ", $" + idx++ + ")");
      params.push(contestId, seed.username, seed.score);
    }

    await pool.query(
      "INSERT INTO contest_seed_users (contest_id, username, score) VALUES " + values.join(", "),
      params
    );

    res.status(201).json({ added: seeds.length });
  } catch (err) {
    console.error("Add seeds error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/contests/:id/seeds/generate - Auto-generate seed users
router.post("/contests/:id/seeds/generate", authRequired, adminRequired, async (req, res) => {
  try {
    const contestId = parseInt(req.params.id);
    const { count = 20, min_score = 5, max_score = 40 } = req.body;

    const botNames = [
      "CryptoKing99", "LuckyAce", "GameMaster", "QuizWhiz", "StarPlayer",
      "SwiftGuess", "ProGamer22", "PointsHunter", "TopScorer", "QuickDraw",
      "BrainStorm", "TriviaKing", "SmartPlay", "GoldRush", "ChampX",
      "NightOwl", "EagleEye", "PixelPro", "VictoryLap", "ThunderBolt",
      "SpeedDemon", "BrainiacX", "FlashPoint", "CoinMaster", "MegaMind",
      "StormRider", "PhoenixRise", "SilverFox", "DiamondHand", "WildCard",
      "AceHigh", "StarGazer", "BlitzKing", "NeonWave", "TurboMax",
      "ZenMaster", "RocketFuel", "IronWill", "GhostRider", "QuantumLeap",
    ];

    // Shuffle and pick names
    const shuffled = botNames.sort(() => Math.random() - 0.5).slice(0, Math.min(count, botNames.length));
    const seeds = shuffled.map((name) => ({
      username: name,
      score: Math.floor(Math.random() * (max_score - min_score + 1)) + min_score,
    }));

    // Clear existing seeds for this contest
    await pool.query("DELETE FROM contest_seed_users WHERE contest_id = $1", [contestId]);

    // Insert new seeds
    const values = [];
    const params = [];
    let idx = 1;
    for (const seed of seeds) {
      values.push("($" + idx++ + ", $" + idx++ + ", $" + idx++ + ")");
      params.push(contestId, seed.username, seed.score);
    }

    await pool.query(
      "INSERT INTO contest_seed_users (contest_id, username, score) VALUES " + values.join(", "),
      params
    );

    res.status(201).json({ generated: seeds.length, seeds: seeds });
  } catch (err) {
    console.error("Generate seeds error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/contests/:id/seeds - Clear seed users
router.delete("/contests/:id/seeds", authRequired, adminRequired, async (req, res) => {
  try {
    await pool.query("DELETE FROM contest_seed_users WHERE contest_id = $1", [parseInt(req.params.id)]);
    res.json({ cleared: true });
  } catch (err) {
    console.error("Clear seeds error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/config - Get game config
router.get("/config", authRequired, adminRequired, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM game_config ORDER BY key");
    res.json({ config: result.rows });
  } catch (err) {
    console.error("Config error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/admin/config/:key - Update game config
router.put("/config/:key", authRequired, adminRequired, async (req, res) => {
  try {
    const { value } = req.body;
    const result = await pool.query(
      "UPDATE game_config SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *",
      [JSON.stringify(value), req.params.key]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Config key not found" });
    res.json({ config: result.rows[0] });
  } catch (err) {
    console.error("Update config error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/withdrawals - List withdrawals
router.get("/withdrawals", authRequired, adminRequired, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT w.*, u.username, u.email
                 FROM withdrawals w JOIN users u ON u.id = w.user_id`;
    const params = [];

    if (status) {
      query += " WHERE w.status = $1";
      params.push(status);
    }

    query += " ORDER BY w.created_at DESC LIMIT 50";
    const result = await pool.query(query, params);
    res.json({ withdrawals: result.rows });
  } catch (err) {
    console.error("Withdrawals error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/withdrawals/:id - Update withdrawal status
router.patch("/withdrawals/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["processing", "completed", "failed", "cancelled"];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const completedAt = status === "completed" ? "NOW()" : "NULL";
    const result = await pool.query(
      `UPDATE withdrawals SET status = $1, completed_at = ${completedAt} WHERE id = $2 RETURNING *`,
      [status, parseInt(req.params.id)]
    );
    res.json({ withdrawal: result.rows[0] });
  } catch (err) {
    console.error("Update withdrawal error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/ledger - View all ledger entries
router.get("/ledger", authRequired, adminRequired, async (req, res) => {
  try {
    const { limit = 50, offset = 0, type, user_id } = req.query;
    let query = `SELECT l.*, u.username FROM ledger l JOIN users u ON u.id = l.user_id`;
    const params = [];
    const conditions = [];
    let idx = 1;

    if (type) { conditions.push("l.type = $" + idx++); params.push(type); }
    if (user_id) { conditions.push("l.user_id = $" + idx++); params.push(parseInt(user_id)); }

    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY l.created_at DESC LIMIT $" + idx++ + " OFFSET $" + idx++;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json({ entries: result.rows });
  } catch (err) {
    console.error("Admin ledger error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
