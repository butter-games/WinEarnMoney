const express = require("express");
const pool = require("../db/pool");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

// Initialize Stripe with secret key
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const MONTHLY_PRICE = 199; // $1.99 in cents
const ANNUAL_PRICE = 1499; // $14.99 in cents

// Ensure Stripe products/prices exist
let monthlyPriceId = null;
let annualPriceId = null;

async function ensureStripePrices() {
  if (monthlyPriceId && annualPriceId) return;

  try {
    // Check if product exists
    const products = await stripe.products.list({ limit: 1 });
    let product = products.data.find((p) => p.metadata.app === "playrealmoneygames");

    if (!product) {
      product = await stripe.products.create({
        name: "PlayRealMoneyGames Pro",
        description: "Unlock all contests, unlimited winnings, and instant withdrawals",
        metadata: { app: "playrealmoneygames" },
      });
    }

    // Check existing prices
    const prices = await stripe.prices.list({ product: product.id, active: true });

    const monthly = prices.data.find((p) => p.recurring && p.recurring.interval === "month");
    const annual = prices.data.find((p) => p.recurring && p.recurring.interval === "year");

    if (!monthly) {
      const created = await stripe.prices.create({
        product: product.id,
        unit_amount: MONTHLY_PRICE,
        currency: "usd",
        recurring: { interval: "month" },
      });
      monthlyPriceId = created.id;
    } else {
      monthlyPriceId = monthly.id;
    }

    if (!annual) {
      const created = await stripe.prices.create({
        product: product.id,
        unit_amount: ANNUAL_PRICE,
        currency: "usd",
        recurring: { interval: "year" },
      });
      annualPriceId = created.id;
    } else {
      annualPriceId = annual.id;
    }

    console.log("Stripe prices ready:", { monthlyPriceId, annualPriceId });
  } catch (err) {
    console.error("Failed to setup Stripe prices:", err.message);
  }
}

// Init prices on startup
ensureStripePrices();

// POST /api/subscription/checkout - Create Stripe Checkout session
router.post("/checkout", authRequired, async (req, res) => {
  try {
    await ensureStripePrices();

    const { plan } = req.body; // "monthly" or "annual"
    const priceId = plan === "annual" ? annualPriceId : monthlyPriceId;

    if (!priceId) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    // Get user email
    const userResult = await pool.query("SELECT email FROM users WHERE id = $1", [req.userId]);
    const email = userResult.rows[0]?.email;

    // Check if user already has a Stripe customer
    let customerId;
    const custResult = await pool.query(
      "SELECT value FROM game_config WHERE key = $1",
      ["stripe_customer_" + req.userId]
    );

    if (custResult.rows.length > 0) {
      customerId = custResult.rows[0].value.customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: email,
        metadata: { user_id: String(req.userId) },
      });
      customerId = customer.id;

      await pool.query(
        "INSERT INTO game_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
        ["stripe_customer_" + req.userId, JSON.stringify({ customer_id: customerId })]
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: (process.env.FRONTEND_URL || "https://playrealmoneygames.com") + "/games/subscription.html?success=true",
      cancel_url: (process.env.FRONTEND_URL || "https://playrealmoneygames.com") + "/games/subscription.html?cancelled=true",
      metadata: { user_id: String(req.userId), plan: plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// POST /api/subscription/portal - Create customer portal session
router.post("/portal", authRequired, async (req, res) => {
  try {
    const custResult = await pool.query(
      "SELECT value FROM game_config WHERE key = $1",
      ["stripe_customer_" + req.userId]
    );

    if (custResult.rows.length === 0) {
      return res.status(400).json({ error: "No subscription found" });
    }

    const customerId = custResult.rows[0].value.customer_id;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: (process.env.FRONTEND_URL || "https://playrealmoneygames.com") + "/games/subscription.html",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Portal error:", err);
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

// GET /api/subscription/status - Check subscription status
router.get("/status", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT subscribed, subscription_plan, subscription_expires FROM users WHERE id = $1",
      [req.userId]
    );
    res.json({
      subscribed: result.rows[0]?.subscribed || false,
      plan: result.rows[0]?.subscription_plan || null,
      expires: result.rows[0]?.subscription_expires || null,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

// Export webhook handler separately (needs raw body)
module.exports.handleWebhook = async function(req, res) {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send("Webhook Error: " + err.message);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = parseInt(session.metadata.user_id);
      const plan = session.metadata.plan || "monthly";

      if (userId) {
        await pool.query(
          "UPDATE users SET subscribed = true, subscription_plan = $1, updated_at = NOW() WHERE id = $2",
          [plan, userId]
        );

        // Log to ledger
        const balResult = await pool.query("SELECT points FROM users WHERE id = $1", [userId]);
        await pool.query(
          "INSERT INTO ledger (user_id, type, amount, balance_after, description) VALUES ($1, 'subscription', 0, $2, $3)",
          [userId, balResult.rows[0]?.points || 0, "Subscribed to " + plan + " plan"]
        );

        console.log("User " + userId + " subscribed to " + plan);
      }
      break;
    }

    case "customer.subscription.deleted":
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      // Find user by customer ID
      const custResult = await pool.query(
        "SELECT key FROM game_config WHERE value->>'customer_id' = $1 AND key LIKE 'stripe_customer_%'",
        [customerId]
      );

      if (custResult.rows.length > 0) {
        const userId = parseInt(custResult.rows[0].key.replace("stripe_customer_", ""));
        const isActive = subscription.status === "active" || subscription.status === "trialing";

        await pool.query(
          "UPDATE users SET subscribed = $1, subscription_expires = $2, updated_at = NOW() WHERE id = $3",
          [isActive, subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null, userId]
        );

        console.log("User " + userId + " subscription " + (isActive ? "active" : "cancelled"));
      }
      break;
    }
  }

  res.json({ received: true });
};
