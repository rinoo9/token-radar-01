[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/rinoo9/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard)
[![reward](https://make.fun/badge/token-radar-01/rinoo9/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

# Token Radar — make.fun bounty token-radar-01

A radar of pre-token protocols, ranked by implied value, with a farm plan for each
one. Entry for the make.fun bounty **"Build the best token launch radar"**
($1,325, deadline Mon Dec 14, 2026, 10:00 UTC / 17:00 WIB).

Owner: GitHub user **rinoo9**. The Solana payout wallet for this entry is recorded
in `.makefun/owner.json` (the wallet the repo is claimed by).

## What it does

`main.ts` (Node 22, standard library only) reads the sealed snapshot at
`/input/snapshot.json`, scores every pre-token protocol with the model in
`lib/model.ts`, and writes to `/output`:

- `board.json` — 240 ranked rows (all 40 watchlist protocols, plus rankable
  protocols above the floor the watchlist leaves out, plus the best rankable
  protocols below the floor, by implied value). Above the floor, wrapped,
  staked or bridged products of tokens that already trade (WBTC, Binance
  staked ETH, USDT0) are left out: they are other people's tokens, not launches.
- `data.js` — the same board, for the dashboard
- `dashboard/` — the static, no-network page (`index.html`, `app.css`, `app.js`)
- `screenshots/` — board, detail and filtered views
- `dossier.json` — built with the vendored `vendor/makefun-board.ts`

## The model (radar-2)

Implied value is what the market already pays for the same kind of protocol,
adjusted for momentum, age and reach. Nothing names a protocol.

```
peer ratio  = median mcap/TVL of tokened protocols in the same category
              (at least 3 peers, else the global median), clamped to 0.03x–1.20x
implied     = round( tvl_usd x peer_ratio
              x (1 + clamp(change_7d, -30, +40) / 100 x 0.5)
              x (0.70 + 0.30 x sqrt(min(age_days, 1460) / 1460))
              x (1 + 0.02 x min(chains - 1, 5)) )
```

Age is days since `listed_at` — how long a protocol has run with no token on
record. "Records no token" is the claim throughout: the snapshot is DefiLlama's
record, never proof a token does not exist. Implied value is this entry's own
estimate, not a price and not a prediction that a token will launch.

## Farm plans

Each row carries five steps, derived from the protocol's own category, chains,
TVL and age: a fresh-wallet setup, the category's main action with a concrete
capital amount, a weekly recurring action, a hold period, and a risk note with
the actual risk for that kind of protocol. Gas costs follow the main chain
(Ethereum is dear, Solana and L2s are cheap).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
```

Then open `out/dashboard/index.html` in a browser (it needs `out/data.js`
beside it) and take the three screenshots: the board, a protocol's detail view,
and a filtered view.

## Files

- `main.ts` — the entry program
- `lib/model.ts` — the model, the board builder and the farm plans
- `dashboard/` — the page
- `screenshots/` — the three screenshots
- `vendor/makefun-board.ts` — make.fun's dossier library, byte for byte from the kit
- `.makefun/owner.json` — the claiming wallet
- `LICENSE` — MIT

## Status

Built and verified locally. The three screenshots in `screenshots/` are real
captures of this dashboard, served from GitHub Pages. The entry is submitted to
the [make.fun bounty](https://make.fun/bounty/token-radar-01) by Muhammad.
