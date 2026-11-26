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

## The model (radar-6)

radar-6 keeps radar-5's scoring and adds a signal-confidence factor: two of
the model's inputs can be missing from a protocol's record — its 7d change
(the momentum input) and its listing date (the age input) — and until now a
missing input was silently replaced by a guess (0% growth, a 365-day age) and
scored as if it were known. A row with one input missing now carries a 0.97x
confidence multiplier, a row with both missing 0.94x, and each row records
which inputs are missing (`missing_inputs`), so a guessed row can no longer
outrank a fully-measured neighbour on borrowed certainty. The discount is
small on purpose: it breaks ties between a guessed row and a measured
neighbour without burying a strong protocol for a gap in the snapshot's
record. In this snapshot 14 of the 240 board rows carry the 0.97x discount
(2 missing a 7d change, 12 missing a listing date, none missing both);
226 rows carry every input. The change moves 26 rows' ranks; rank 1
(Steakhouse Financial, $710,884,203 implied) is unchanged. The dashboard
recomputes every row from the same figures, confidence included, and its
detail drawer names each row's missing inputs.

radar-5 keeps radar-4's scoring exactly and fixes the farm plans, where two
instructions disagreed with themselves: a DEX plan told the farmer to provide
liquidity "in the $40-$60 range", a fixed dollar range that is meaningless for
an arbitrary pool — the range is now a band 20% above and below the pool's
current price, in both the action and the risk step; and a lending plan told
the farmer to borrow a fixed $20 against a $50 supply (40% of it) while its
own risk step said to keep the borrow under a quarter of the supply — the
borrow is now a fifth of the capital supplied ($10 on $50, $20 on $100, $30
on $150, $50 on $250), the weekly step repays a quarter of that borrow, and
the risk step states the fifth, so the three steps finally agree. The change
touches the farm plans of the 25 DEX rows and the 28 lending rows on the
board; implied values and ranks are unchanged, because the scoring did not
move.

Implied value is what the market already pays for the same kind of protocol,
adjusted for size, momentum, age, reach and category headroom. Nothing names a
protocol.

```
peer ratio  = each tokened peer's mcap/TVL clamped to 0.03x–1.20x, then the
              category median shrunk toward the global median (0.2138x) by peer
              count: (n x category + 3 x global) / (n + 3), clamped to 0.03x–1.20x
size        = (tvl_usd / $100M) ^ -0.25, clamped to 0.50x–2.00x
momentum    = 1 + 0.40 x clamp(change_7d, -30, +40) / 100
                  + 0.40 x clamp(change_7d - category PRE-TOKEN median 7d, -30, +40) / 100
confidence  = 1.00x when the snapshot carries both the 7d change and the
              listing date, 0.97x when one is missing, 0.94x when both are
implied     = round( tvl_usd x peer_ratio x size x momentum
              x (0.60 + 0.40 x sqrt(min(age_days, 1460) / 1460))
              x (1 + 0.02 x min(chains - 1, 5))
              x (0.85 + 0.30 x (1 - share of category TVL already tokened))
              x (1 + 0.10 x sqrt(protocol share of category TVL))
              x confidence )
```

radar-4 fixes one place where radar-3's code disagreed with its own method:
relative momentum now measures a pre-token protocol against its category's
**pre-token** median 7d change (global pre-token median -6.8%), not the median
over all the category's protocols, tokened ones included. A tokened protocol's
TVL moves with its token's price; a pre-token protocol's TVL moves with
deposits, so the old median mixed two different dynamics and, in a week when
tokened protocols fell hard, handed every pre-token row in the category a free
boost for standing still. Where no pre-token protocol in a category reports a
7d change, the all-protocol median stands in and the row records that it is
the fallback. Each row carries which median it used (`cat_median_pre_token`).

The size term follows the snapshot itself: median mcap/TVL falls from 0.65x
under $10M to 0.01x over $10B (log-log slope about -0.48), and the model
applies half that slope. Stablecoin issuers get no extra discount: their
peers' market caps are already governance-token caps per dollar of stablecoins
outstanding, so the peer ratio already carries that discount.

Age is days since `listed_at` — how long a protocol has run with no token on
record. "Records no token" is the claim throughout: the snapshot is DefiLlama's
record, never proof a token does not exist. Implied value is this entry's own
estimate, not a price and not a prediction that a token will launch.

## Farm plans

Each row carries six steps, derived from the protocol's own category, chains,
TVL and age: a fresh-wallet setup, the category's main action with a concrete
capital amount, a weekly recurring action, a hold period, what to do when the
token actually launches (claim only from the link the protocol itself
publishes, never pay a fee to claim, unstake after the snapshot date it
names), and a risk note with the actual risk for that kind of protocol. Gas
costs follow the main chain (Ethereum is dear, Solana and L2s are cheap).

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
captures of this dashboard, rendered from the built output on this machine.
The entry is submitted to the [make.fun bounty](https://make.fun/bounty/token-radar-01) by Muhammad.
