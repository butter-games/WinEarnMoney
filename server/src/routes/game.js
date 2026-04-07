const express = require("express");
const pool = require("../db/pool");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

// GET /api/game/config - Get server-controlled scoring config
router.get("/config", async (req, res) => {
  try {
    const result = await pool.query("SELECT key, value FROM game_config");
    const config = {};
    result.rows.forEach((row) => {
      config[row.key] = row.value;
    });
    res.json({ config });
  } catch (err) {
    console.error("Config error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/game/dice - Server-side dice roll (prevents cheating)
router.post("/dice", authRequired, async (req, res) => {
  try {
    const diceValue = Math.floor(Math.random() * 6) + 1;
    res.json({ dice: diceValue });
  } catch (err) {
    console.error("Dice error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/game/contests - List active contests
router.get("/contests", authRequired, async (req, res) => {
  try {
    const now = new Date();
    const result = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM contest_leaderboard cl WHERE cl.contest_id = c.id) +
              (SELECT COUNT(*) FROM contest_seed_users cs WHERE cs.contest_id = c.id) as player_count
       FROM contests c
       WHERE c.ends_at > $1
       ORDER BY c.is_daily DESC, c.starts_at ASC`,
      [now]
    );

    // Get user's best scores and attempts for each contest
    const contests = [];
    for (const contest of result.rows) {
      const lb = await pool.query(
        "SELECT best_score, attempts FROM contest_leaderboard WHERE user_id = $1 AND contest_id = $2",
        [req.userId, contest.id]
      );
      contests.push({
        ...contest,
        my_best_score: lb.rows[0]?.best_score || 0,
        my_attempts: lb.rows[0]?.attempts || 0,
      });
    }

    res.json({ contests });
  } catch (err) {
    console.error("Contests error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/game/contests/:id/submit - Submit a contest attempt
router.post("/contests/:id/submit", authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const contestId = parseInt(req.params.id);
    const { score, answers } = req.body;

    // Validate contest exists and is active
    const contestResult = await client.query(
      "SELECT * FROM contests WHERE id = $1 AND ends_at > NOW()",
      [contestId]
    );
    if (contestResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Contest not found or ended" });
    }

    const contest = contestResult.rows[0];

    // Check subscription requirement
    if (contest.type === "subscriber") {
      const userResult = await client.query(
        "SELECT subscribed FROM users WHERE id = $1",
        [req.userId]
      );
      if (!userResult.rows[0]?.subscribed) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Subscription required" });
      }
    }

    // Check attempt limit
    const lbResult = await client.query(
      "SELECT best_score, attempts FROM contest_leaderboard WHERE user_id = $1 AND contest_id = $2",
      [req.userId, contestId]
    );

    const currentAttempts = lbResult.rows[0]?.attempts || 0;
    const currentBest = lbResult.rows[0]?.best_score || 0;

    if (currentAttempts >= contest.max_attempts) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Maximum attempts reached" });
    }

    // Record the attempt
    await client.query(
      "INSERT INTO contest_attempts (user_id, contest_id, score, answers) VALUES ($1, $2, $3, $4)",
      [req.userId, contestId, score, JSON.stringify(answers || [])]
    );

    // Update leaderboard (upsert best score)
    const newBest = Math.max(currentBest, score);
    await client.query(
      `INSERT INTO contest_leaderboard (user_id, contest_id, best_score, attempts, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, contest_id) DO UPDATE
       SET best_score = GREATEST(contest_leaderboard.best_score, $3),
           attempts = contest_leaderboard.attempts + 1,
           updated_at = NOW()`,
      [req.userId, contestId, score, 1]
    );

    // Award points for improvement only (must meet min score threshold)
    const minScore = contest.min_score_for_points || 0;
    const improvement = Math.max(0, score - currentBest);
    if (improvement > 0 && score >= minScore) {
      await client.query(
        "UPDATE users SET points = points + $1, games_played = games_played + 1 WHERE id = $2",
        [improvement, req.userId]
      );

      // Get updated balance for ledger
      const balResult = await client.query("SELECT points FROM users WHERE id = $1", [req.userId]);
      const balanceAfter = balResult.rows[0].points;

      await client.query(
        `INSERT INTO ledger (user_id, type, amount, balance_after, description, metadata)
         VALUES ($1, 'tournament_win', $2, $3, $4, $5)`,
        [
          req.userId,
          improvement,
          balanceAfter,
          `Tournament score improvement (+${improvement} pts)`,
          JSON.stringify({ contest_id: contestId, score, attempt: currentAttempts + 1 }),
        ]
      );
    }

    await client.query("COMMIT");

    res.json({
      score,
      best_score: newBest,
      attempts: currentAttempts + 1,
      improvement,
      max_attempts: contest.max_attempts,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Submit error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// GET /api/game/contests/:id/leaderboard
router.get("/contests/:id/leaderboard", authRequired, async (req, res) => {
  try {
    const contestId = parseInt(req.params.id);

    // Get real players
    const realResult = await pool.query(
      `SELECT cl.best_score as score, u.username, 'real' as type
       FROM contest_leaderboard cl
       JOIN users u ON u.id = cl.user_id
       WHERE cl.contest_id = $1`,
      [contestId]
    );

    // Get seed users
    const seedResult = await pool.query(
      `SELECT score, username, 'seed' as type
       FROM contest_seed_users WHERE contest_id = $1`,
      [contestId]
    );

    // Merge and sort
    const combined = [...realResult.rows, ...seedResult.rows]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((p, i) => ({
        username: p.username,
        best_score: p.score,
        rank: i + 1,
      }));

    // Get user's rank
    const userScore = realResult.rows.find((r) => true); // will check below
    const myScoreResult = await pool.query(
      "SELECT best_score FROM contest_leaderboard WHERE contest_id = $1 AND user_id = $2",
      [contestId, req.userId]
    );
    const myScore = myScoreResult.rows[0]?.best_score || 0;
    const myRank = combined.filter((p) => p.best_score > myScore).length + 1;

    res.json({
      leaderboard: combined,
      my_rank: myRank,
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/game/reveal/submit - Submit reveal game score
router.post("/reveal/submit", authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { category, score, correct_count, total_rounds } = req.body;

    if (!category || score === undefined) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Category and score are required" });
    }

    if (score <= 0) {
      await client.query("COMMIT");
      return res.json({ points_awarded: 0, balance: 0 });
    }

    // Award points
    await client.query(
      "UPDATE users SET points = points + $1, games_played = games_played + 1 WHERE id = $2",
      [score, req.userId]
    );

    const balResult = await client.query("SELECT points FROM users WHERE id = $1", [req.userId]);
    const balanceAfter = balResult.rows[0].points;

    // Log to ledger
    await client.query(
      `INSERT INTO ledger (user_id, type, amount, balance_after, description, metadata)
       VALUES ($1, 'game_win', $2, $3, $4, $5)`,
      [
        req.userId,
        score,
        balanceAfter,
        `Reveal ${category} - ${correct_count}/${total_rounds} correct (+${score} pts)`,
        JSON.stringify({ category, correct_count, total_rounds }),
      ]
    );

    await client.query("COMMIT");

    res.json({ points_awarded: score, balance: balanceAfter });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Reveal submit error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

module.exports = router;
