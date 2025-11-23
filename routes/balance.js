import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { stakeAddress } = req.body;

    if (!stakeAddress) {
      return res.status(400).json({ error: "stakeAddress required" });
    }

    // ---- Koios POST ----
    const koiosResp = await fetch("https://api.koios.rest/api/v1/account_info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        _stake_addresses: [stakeAddress],
      }),
    });

    const data = await koiosResp.json();

    if (!Array.isArray(data) || data.length === 0) {
      return res.json({ votingPower: 0 });
    }

    const acct = data[0];
    const lovelace = Number(acct.total_balance ?? acct.balance ?? 0);
    const ada = lovelace / 1_000_000;

    return res.json({ votingPower: ada });
  } catch (err) {
    console.error("Balance lookup error:", err);
    res.json({ votingPower: 0 });
  }
});

export default router;
