const express = require("express");
const pool = require("../db/pool");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

const POINTS_TO_DOLLAR = 100;

// GET /api/wallet/balance
router.get("/balance", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT points, total_withdrawn FROM users WHERE id = $1",
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const { points, total_withdrawn } = result.rows[0];
    const dollarBalance = points / POINTS_TO_DOLLAR;
    const totalEarned = dollarBalance + parseFloat(total_withdrawn);

    res.json({
      points,
      dollar_balance: dollarBalance,
      total_earned: totalEarned,
      total_withdrawn: parseFloat(total_withdrawn),
    });
  } catch (err) {
    console.error("Balance error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/wallet/ledger
router.get("/ledger", authRequired, async (req, res) => {
  try {
    const { type, from, to, limit = 50, offset = 0 } = req.query;

    let query = "SELECT * FROM ledger WHERE user_id = $1";
    const params = [req.userId];
    let paramIndex = 2;

    if (type) {
      query += ` AND type = $${paramIndex++}`;
      params.push(type);
    }
    if (from) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(to);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Summary
    const summaryResult = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_earned,
         COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_spent,
         COUNT(CASE WHEN type = 'game_win' THEN 1 END) as game_wins,
         COUNT(CASE WHEN type = 'tournament_win' THEN 1 END) as tournament_wins,
         COUNT(CASE WHEN type = 'withdrawal' THEN 1 END) as withdrawals
       FROM ledger WHERE user_id = $1`,
      [req.userId]
    );

    res.json({
      entries: result.rows,
      summary: summaryResult.rows[0],
    });
  } catch (err) {
    console.error("Ledger error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/wallet/withdraw
router.post("/withdraw", authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { amount, method, account_details } = req.body;

    if (!amount || !method || !account_details) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Amount, method, and account details are required" });
    }

    const validMethods = ["paypal", "bank", "giftcard", "crypto"];
    if (!validMethods.includes(method)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid withdrawal method" });
    }

    // Get min withdrawal from config
    const configResult = await client.query(
      "SELECT value FROM game_config WHERE key = 'min_withdrawal'"
    );
    const minWithdrawal = configResult.rows[0]?.value?.amount || 1.0;

    if (amount < minWithdrawal) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Minimum withdrawal is $${minWithdrawal}` });
    }

    const pointsToDeduct = Math.round(amount * POINTS_TO_DOLLAR);

    // Check balance
    const userResult = await client.query(
      "SELECT points FROM users WHERE id = $1 FOR UPDATE",
      [req.userId]
    );
    const currentPoints = userResult.rows[0]?.points || 0;

    if (pointsToDeduct > currentPoints) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Deduct points
    await client.query(
      "UPDATE users SET points = points - $1, total_withdrawn = total_withdrawn + $2 WHERE id = $3",
      [pointsToDeduct, amount, req.userId]
    );

    // Create withdrawal record
    const wdResult = await client.query(
      `INSERT INTO withdrawals (user_id, amount, points_deducted, method, account_details)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, amount, pointsToDeduct, method, account_details]
    );

    // Get updated balance for ledger
    const balResult = await client.query("SELECT points FROM users WHERE id = $1", [req.userId]);
    const balanceAfter = balResult.rows[0].points;

    // Log to ledger
    await client.query(
      `INSERT INTO ledger (user_id, type, amount, balance_after, description, metadata)
       VALUES ($1, 'withdrawal', $2, $3, $4, $5)`,
      [
        req.userId,
        -pointsToDeduct,
        balanceAfter,
        `Withdrawal $${amount.toFixed(2)} via ${method}`,
        JSON.stringify({ withdrawal_id: wdResult.rows[0].id, method, dollar_amount: amount }),
      ]
    );

    await client.query("COMMIT");

    res.json({ withdrawal: wdResult.rows[0], balance_after: balanceAfter });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Withdraw error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// GET /api/wallet/withdrawals
router.get("/withdrawals", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
      [req.userId]
    );
    res.json({ withdrawals: result.rows });
  } catch (err) {
    console.error("Withdrawals error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
