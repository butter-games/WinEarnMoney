const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");
const { authRequired, generateToken } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, referral_code } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: "Username must be 3-20 characters" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if user exists
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [email.toLowerCase(), username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email or username already exists" });
    }

    // Generate unique referral code
    const userRefCode = username.slice(0, 4).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, referral_code)
       VALUES ($1, $2, $3, $4) RETURNING id, username, email, points, games_played, subscribed, referral_code, created_at`,
      [username, email.toLowerCase(), passwordHash, userRefCode]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    // Process referral bonus
    if (referral_code) {
      try {
        const referrer = await pool.query("SELECT id FROM users WHERE referral_code = $1", [referral_code]);
        if (referrer.rows.length > 0) {
          const referrerId = referrer.rows[0].id;
          // Get referral bonus config
          const configResult = await pool.query("SELECT value FROM game_config WHERE key = 'referral'");
          const bonusConfig = configResult.rows[0]?.value || { bonus_referrer: 50, bonus_referred: 25 };

          // Create referral record
          await pool.query("INSERT INTO referrals (referrer_id, referred_id, bonus_awarded) VALUES ($1, $2, true)", [referrerId, user.id]);

          // Award bonus to referrer
          await pool.query("UPDATE users SET points = points + $1 WHERE id = $2", [bonusConfig.bonus_referrer, referrerId]);
          const refBal = await pool.query("SELECT points FROM users WHERE id = $1", [referrerId]);
          await pool.query(
            "INSERT INTO ledger (user_id, type, amount, balance_after, description) VALUES ($1, 'signup_bonus', $2, $3, $4)",
            [referrerId, bonusConfig.bonus_referrer, refBal.rows[0].points, "Referral bonus - " + username + " signed up"]
          );

          // Award bonus to new user
          await pool.query("UPDATE users SET points = points + $1 WHERE id = $2", [bonusConfig.bonus_referred, user.id]);
          user.points += bonusConfig.bonus_referred;
          await pool.query(
            "INSERT INTO ledger (user_id, type, amount, balance_after, description) VALUES ($1, 'signup_bonus', $2, $3, $4)",
            [user.id, bonusConfig.bonus_referred, user.points, "Welcome bonus - referred by a friend"]
          );
        }
      } catch (refErr) {
        console.warn("Referral processing error:", refErr);
      }
    }

    res.status(201).json({ token, user });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await pool.query(
      `SELECT id, username, email, password_hash, points, games_played,
              subscribed, subscription_plan, total_withdrawn, created_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken(user.id);
    delete user.password_hash;

    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/me
router.get("/me", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, points, games_played,
              subscribed, subscription_plan, total_withdrawn, referral_code, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/referrals - Get user's referral stats
router.get("/referrals", authRequired, async (req, res) => {
  try {
    const user = await pool.query("SELECT referral_code FROM users WHERE id = $1", [req.userId]);
    const referrals = await pool.query(
      `SELECT r.created_at, u.username FROM referrals r
       JOIN users u ON u.id = r.referred_id
       WHERE r.referrer_id = $1 ORDER BY r.created_at DESC`,
      [req.userId]
    );
    const configResult = await pool.query("SELECT value FROM game_config WHERE key = 'referral'");
    const bonusConfig = configResult.rows[0]?.value || { bonus_referrer: 50, bonus_referred: 25 };

    res.json({
      referral_code: user.rows[0]?.referral_code,
      total_referrals: referrals.rows.length,
      total_earned: referrals.rows.length * bonusConfig.bonus_referrer,
      bonus_per_referral: bonusConfig.bonus_referrer,
      bonus_for_friend: bonusConfig.bonus_referred,
      referrals: referrals.rows,
    });
  } catch (err) {
    console.error("Referrals error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
