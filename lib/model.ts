// The token radar's model (radar-6): one snapshot of the protocol universe in, one ranked
// board out. radar-6 keeps radar-5's scoring and adds a signal-confidence factor: two
// of the model's inputs can be missing from a protocol's record — its 7d change (the
// momentum input) and its listing date (the age input) — and until now a missing
// input was silently replaced by a guess (0% growth, a 365-day age) and scored as
// if it were known. A row with one input missing now carries a 0.97x confidence
// multiplier, a row with both missing 0.94x, and each row records which inputs are
// missing, so a guessed row can no longer outrank a fully-measured neighbour on
// borrowed certainty. In this snapshot 14 of the 240 board rows carry the 0.97x
// discount (2 missing a 7d change, 12 missing a listing date, none missing both).
// radar-5 keeps radar-4's scoring exactly and fixes the farm plans, where
// two instructions disagreed with themselves: the DEX plan's fixed "$40-$60 range"
// is now a band 20% above and below the pool's current price, and the lending
// plan's fixed $20 borrow is now a fifth of the capital supplied, so it stays
// under the quarter its own risk step demands. See the farmSteps comment below.
// median when the category had fewer than 3 priced peers), times growth, maturity and
// chain reach — and the top of its board was nearly a TVL table: Risk Curators and
// Onchain Capital Allocator, the two thinnest categories at the top, both collapsed to
// the global 0.214x, so the biggest TVLs won by default. radar-3 keeps the same idea
// (what the market already pays for the same kind of protocol) and fixes the places
// where radar-2 ignored what the snapshot actually says. radar-4 keeps radar-3's
// model and fixes one place where radar-3's own code disagreed with its method:
// its relative momentum compared a pre-token protocol's growth against its
// category's median over ALL protocols, tokened ones included, while its method
// said the pre-token median. A tokened protocol's TVL moves with its token's
// price; a pre-token protocol's TVL moves with deposits. radar-4 measures
// relative momentum against the category's pre-token median, falling back to the
// all-protocol median only where no pre-token protocol reports a 7d change, and
// each row records which median it used. radar-4 also adds the farm plan's sixth
// step: what to do when the token actually launches.
//
//   peer ratio   = for each category, the median mcap/TVL of its tokened protocols,
//                  with each peer's ratio clamped to [0.03, 1.20] BEFORE the median,
//                  then shrunk toward the global median by peer count:
//                  (n x cat_median + 3 x global) / (n + 3), clamped again to
//                  [0.03, 1.20]. A thin category now informs its rows instead of
//                  collapsing to the global number, and one wild peer cannot set the
//                  price even through shrinkage: the snapshot's only Prediction Market
//                  peer trades at 400x TVL, Risk Curators' only peer at 2.98x, and
//                  both are clamped to 1.20x before they enter the median. After
//                  shrinkage Risk Curators is 0.460x (1 peer), Onchain Capital
//                  Allocator 0.140x (2 peers at 0.006x and 0.019x — the category
//                  really does trade cheap), CDP 0.191x (3 peers, median 0.169x).
//                  The global median over the 128 priced protocols is 0.2138x.
//   size         = (tvl_usd / $100M) ^ -0.25, clamped to [0.50, 2.00]. The market pays
//                  fewer dollars of mcap per dollar of TVL as protocols get bigger:
//                  the snapshot's priced protocols show median mcap/TVL of 0.65x
//                  under $10M, 0.29x at $10-100M, 0.10x at $100M-1B, 0.03x at
//                  $1-10B and 0.01x over $10B, a log-log slope of about -0.48.
//                  radar-3 applies half that slope, so the correction is
//                  conservative and does not double-count what the category median
//                  already carries. The biggest rows are halved; the smallest double.
//   momentum     = 1 + 0.40 x clamp(change_7d, -30, +40)/100
//                      + 0.40 x clamp(change_7d - cat_median_7d_pre, -30, +40)/100.
//                  The second term is RELATIVE momentum: growth against the
//                  category's own PRE-TOKEN median 7d change (global pre-token
//                  median -6.8%), so growing in a shrinking category counts more
//                  than growing with the crowd. radar-3 measured it against the
//                  median over ALL the category's protocols, tokened ones
//                  included — but a tokened protocol's TVL moves with its token's
//                  price, while a pre-token protocol's TVL moves with deposits,
//                  so the all-protocol median mixed two different dynamics and,
//                  in a week when tokened protocols fell hard, handed every
//                  pre-token row in the category a free boost for standing still.
//                  radar-4 compares a pre-token protocol against its own kind.
//                  When no pre-token protocol in a category reports a 7d change,
//                  the all-protocol median is used instead and the row says so.
//                  Range 0.76-1.32. The snapshot's wildest week,
//                  +4448% for one small Yield protocol, is clamped to +40 on both
//                  terms and lands mid-board, not at the top. A missing 7d change
//                  scores 0 on both terms.
//   maturity     = 0.60 + 0.40 x sqrt(min(age_days, 1460) / 1460); age is days since
//                  listed_at, the record of how long a protocol has run with no
//                  token. Longer untokened means more pent-up launch value, with
//                  diminishing returns; unknown age uses 365 days. Range 0.60-1.00,
//                  wider than radar-2's 0.70-1.00, so age visibly moves ranks.
//   chainMult    = 1 + 0.02 x min(chains - 1, 5); a protocol live on more chains has
//                  a wider farming surface. Range 1.00-1.10.
//   headroom     = 0.85 + 0.30 x (1 - tokened_share), where tokened_share is the
//                  share of the category's TVL that already belongs to tokened
//                  protocols. A category where most value already trades (Lending,
//                  98% tokened) has less launch headroom than one that does not
//                  (Risk Curators, 4% tokened). Range 0.85-1.15.
//   dominance    = 1 + 0.10 x sqrt(protocol TVL / category TVL). The protocol that
//                  IS its category's TVL is the category's flagship launch; a 1%
//                  share barely moves it, a 94% share adds the full 10%.
//   confidence   = 1.00 when the snapshot carries both the 7d change and the
//                  listing date, 0.97 when one of them is missing, 0.94 when both
//                  are. A missing input is still replaced by its neutral guess
//                  (0% growth, a 365-day age) so the row can be scored at all, but
//                  the guess is no longer presented as knowledge: the row is
//                  discounted for the input it does not have, and it names the
//                  missing inputs, so the dashboard can say which.
//   implied      = max(1, round(tvl x peer_ratio x size x momentum x maturity
//                  x chainMult x headroom x dominance x confidence))
//
// Stablecoin issuers: NO extra discount, decided from the category field only and
// never by protocol name. A stablecoin issuer's TVL is the stablecoins
// outstanding, which already trade — but its category peers' market caps are
// their GOVERNANCE tokens' caps, so the peer ratio already is the market's
// price for a stablecoin issuer's governance token per dollar of stablecoins
// outstanding (CDP peers: 0.008x, 0.169x, 0.246x; median 0.169x, below the
// global 0.214x). An extra haircut would double-count the discount the peer
// ratio already carries. The size factor and headroom still move them: the
// biggest CDP row falls from #5 in radar-2 to #8 here.
//
// Nothing here names a protocol: every constant is computed from, or applied uniformly
// to, the snapshot's own figures. A protocol is pre-token when its record carries no
// market cap, no CoinGecko id and no symbol. Tokened protocols are never ranked; the
// dashboard shows the biggest of them separately, at their market cap, as the market's
// own values. "Records no token" is the claim throughout: the snapshot is DefiLlama's
// record, not proof a token does not exist.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  peer_min: number;
  peer_max: number;
  shrink_k: number;
  size_ref_usd: number;
  size_exponent: number;
  size_min: number;
  size_max: number;
  growth_floor: number;
  growth_cap: number;
  rel_floor: number;
  rel_cap: number;
  momentum_abs_weight: number;
  momentum_rel_weight: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max_extra: number;
  headroom_floor: number;
  headroom_range: number;
  dominance_step: number;
  /** The confidence multiplier for a row with exactly one model input missing. */
  confidence_missing_one: number;
  /** The confidence multiplier for a row with both model inputs missing. */
  confidence_missing_both: number;
}

export const MODEL: ModelConstants = {
  peer_min: 0.03,
  peer_max: 1.2,
  shrink_k: 3,
  size_ref_usd: 100_000_000,
  size_exponent: 0.25,
  size_min: 0.5,
  size_max: 2.0,
  growth_floor: -30,
  growth_cap: 40,
  rel_floor: -30,
  rel_cap: 40,
  momentum_abs_weight: 0.4,
  momentum_rel_weight: 0.4,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1460,
  unknown_age_days: 365,
  chain_step: 0.02,
  chain_max_extra: 0.1,
  headroom_floor: 0.85,
  headroom_range: 0.3,
  dominance_step: 0.1,
  confidence_missing_one: 0.97,
  confidence_missing_both: 0.94,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-6';

/** Board size: watchlist (40) + rankable protocols above the floor the watchlist leaves
 *  out + the best rankable protocols below the floor, by implied value. */
export const BOARD_ROWS = 240;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    peer_ratio: number;
    raw_peer_ratio: number | null;
    peer_count: number;
    growth_pct: number;
    rel_growth_pct: number;
    momentum_multiplier: number;
    size_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    headroom_multiplier: number;
    dominance_multiplier: number;
    cat_median_change: number;
    cat_median_pre_token: boolean;
    cat_tokened_share: number;
    cat_share: number;
    age_days: number | null;
    confidence_multiplier: number;
    missing_inputs: string[];
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, farm plan included so page and board agree. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  watchlist: boolean;
  peer_ratio: number;
  raw_peer_ratio: number | null;
  peer_count: number;
  momentum_multiplier: number;
  size_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  headroom_multiplier: number;
  dominance_multiplier: number;
  rel_growth_pct: number;
  cat_median_change: number;
  cat_median_pre_token: boolean;
  cat_tokened_share: number;
  cat_share: number;
  confidence_multiplier: number;
  missing_inputs: string[];
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's peer ratio, for the methodology table. */
export interface PeerRatio {
  category: string;
  ratio: number;
  raw_ratio: number | null;
  peers: number;
}

/** Everything the dashboard needs: the board, the live set, the peer table and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  /** Board rows whose snapshot record carries every model input (no discount). */
  full_data_rows: number;
  global_peer_ratio: number;
  peer_ratios: PeerRatio[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Median of a sorted array, or `fallback` when empty. */
function median(sorted: number[], fallback: number): number {
  if (sorted.length === 0) return fallback;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/**
 * The watchlist's own exclusion, applied to protocols above the floor that the
 * watchlist leaves out: a wrapped, staked or bridged product of a token that already
 * trades is not a token that does not exist yet. WBTC is Bitcoin on Ethereum,
 * Binance staked ETH is ETH in Binance's staking product, USDT0 is Tether on
 * another chain — ranking them at the top would make the board a list of other
 * people's tokens. The categories, the name words and the exchange prefixes are
 * the watchlist rule's, applied here to the same kind of record.
 */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

export function isCleanLaunch(p: SnapshotProtocol): boolean {
  return (
    isRankable(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** One category's snapshot figures: its total TVL, the share already tokened, and its median 7d change. */
export interface CategoryStats {
  total_tvl: number;
  tokened_share: number;
  median_change: number;
  /** The median 7d change over the category's PRE-TOKEN protocols only, or null when none reports one. */
  median_change_pre: number | null;
}

/** The per-category figures the model needs, computed from the snapshot at run time. */
export function categoryStats(snapshot: Snapshot): Map<string, CategoryStats> {
  const acc = new Map<string, { tvl: number; tokTvl: number; changes: number[]; preChanges: number[] }>();
  for (const p of snapshot.protocols) {
    const key = p.category ?? 'Other';
    const a = acc.get(key) ?? { tvl: 0, tokTvl: 0, changes: [], preChanges: [] };
    a.tvl += p.tvl_usd;
    if (!isPreToken(p)) a.tokTvl += p.tvl_usd;
    if (p.change_7d !== null) {
      a.changes.push(p.change_7d);
      if (isPreToken(p)) a.preChanges.push(p.change_7d);
    }
    acc.set(key, a);
  }
  const out = new Map<string, CategoryStats>();
  for (const [key, a] of acc) {
    a.changes.sort((x, y) => x - y);
    a.preChanges.sort((x, y) => x - y);
    out.set(key, {
      total_tvl: a.tvl,
      tokened_share: a.tvl > 0 ? a.tokTvl / a.tvl : 0,
      median_change: median(a.changes, 0),
      median_change_pre: a.preChanges.length > 0 ? median(a.preChanges, 0) : null,
    });
  }
  return out;
}

/**
 * The peer ratios, computed from the snapshot at run time: for each category, the median
 * mcap/TVL of its tokened protocols, each peer clamped to [peer_min, peer_max] first so
 * one wild peer (400x, 36x, 19x) cannot set the price, then shrunk toward the global
 * median by peer count: (n x cat_median + k x global) / (n + k), clamped again. A
 * category with no priced peer uses the global median outright.
 */
export function peerRatios(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, { ratio: number; raw: number | null; peers: number }>; global: number } {
  const byCat = new Map<string, number[]>();
  const all: number[] = [];
  const clamp = (r: number): number => Math.min(model.peer_max, Math.max(model.peer_min, r));
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    const clamped = clamp(ratio);
    all.push(clamped);
    const key = p.category ?? 'Other';
    const arr = byCat.get(key) ?? [];
    arr.push(clamped);
    byCat.set(key, arr);
  }
  all.sort((a, b) => a - b);
  const global = clamp(median(all, 0.25));
  const byCategory = new Map<string, { ratio: number; raw: number | null; peers: number }>();
  for (const [cat, ratios] of byCat) {
    ratios.sort((a, b) => a - b);
    const raw = median(ratios, global);
    byCategory.set(cat, {
      ratio: clamp((ratios.length * raw + model.shrink_k * global) / (ratios.length + model.shrink_k)),
      raw,
      peers: ratios.length,
    });
  }
  return { byCategory, global };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  peers: { byCategory: Map<string, { ratio: number; raw: number | null; peers: number }>; global: number },
  stats: Map<string, CategoryStats>,
  model: ModelConstants,
): {
  implied: number;
  peerRatio: number;
  rawPeerRatio: number | null;
  peerCount: number;
  growthPct: number;
  relGrowthPct: number;
  momentumMult: number;
  sizeMult: number;
  maturityMult: number;
  chainMult: number;
  headroomMult: number;
  dominanceMult: number;
  catMedianChange: number;
  catMedianPreToken: boolean;
  catTokenedShare: number;
  catShare: number;
  age: number | null;
  confidenceMult: number;
  missingInputs: string[];
} {
  const age = ageDays(asOf, protocol.listed_at);
  const key = protocol.category ?? 'Other';
  const peer = peers.byCategory.get(key);
  const peerRatio = peer !== undefined ? peer.ratio : peers.global;
  const rawPeerRatio = peer !== undefined ? peer.raw : null;
  const peerCount = peer !== undefined ? peer.peers : 0;
  const stat = stats.get(key) ?? { total_tvl: 0, tokened_share: 0, median_change: 0, median_change_pre: null };
  const catShare = stat.total_tvl > 0 ? protocol.tvl_usd / stat.total_tvl : 0;
  // Size: the market pays less mcap per TVL dollar as protocols get bigger; half the
  // snapshot's fitted log-log slope (-0.48), anchored at $100M, clamped [0.50, 2.00].
  const sizeMult = Math.min(model.size_max, Math.max(model.size_min, Math.pow(protocol.tvl_usd / model.size_ref_usd, -model.size_exponent)));
  // Momentum: absolute 7d growth plus growth relative to the category's own PRE-TOKEN
  // median week — a pre-token protocol is judged against its own kind, whose TVL moves
  // with deposits, not against tokened protocols, whose TVL moves with token prices.
  // Where no pre-token protocol in the category reports a 7d change, the all-protocol
  // median stands in and the row records that it is the fallback. A missing 7d change
  // scores 0 on both terms.
  const catMedianChange = stat.median_change_pre ?? stat.median_change;
  const catMedianPreToken = stat.median_change_pre !== null;
  const growthPct = protocol.change_7d === null ? 0 : Math.min(model.growth_cap, Math.max(model.growth_floor, protocol.change_7d));
  const relGrowthPct = protocol.change_7d === null ? 0 : Math.min(model.rel_cap, Math.max(model.rel_floor, protocol.change_7d - catMedianChange));
  const momentumMult = 1 + (growthPct / 100) * model.momentum_abs_weight + (relGrowthPct / 100) * model.momentum_rel_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + model.maturity_range * Math.sqrt(Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days);
  const chainMult = 1 + Math.min(model.chain_max_extra, Math.max(0, protocol.chains.length - 1) * model.chain_step);
  const headroomMult = model.headroom_floor + model.headroom_range * (1 - stat.tokened_share);
  const dominanceMult = 1 + model.dominance_step * Math.sqrt(Math.max(0, catShare));
  // Confidence: the two inputs the model cannot see are named, not hidden. A
  // missing 7d change is scored as 0% growth and a missing listing date as a
  // 365-day age, so the row can be scored at all — but a guess is not knowledge,
  // and the row is discounted for each input it does not have: 0.97x for one
  // missing, 0.94x for both. The discount is small on purpose: it breaks ties
  // between a guessed row and a measured neighbour without burying a strong
  // protocol for a gap in the snapshot's record.
  const missingInputs: string[] = [];
  if (protocol.change_7d === null) missingInputs.push('7d change');
  if (age === null) missingInputs.push('listing date');
  const confidenceMult = missingInputs.length === 0 ? 1 : missingInputs.length === 1 ? model.confidence_missing_one : model.confidence_missing_both;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * peerRatio * sizeMult * momentumMult * maturityMult * chainMult * headroomMult * dominanceMult * confidenceMult));
  return { implied, peerRatio, rawPeerRatio, peerCount, growthPct, relGrowthPct, momentumMult, sizeMult, maturityMult, chainMult, headroomMult, dominanceMult, catMedianChange, catMedianPreToken, catTokenedShare: stat.tokened_share, catShare, age, confidenceMult, missingInputs };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const peers = peerRatios(snapshot, model);
  const stats = categoryStats(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it, whatever its score.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // Above the floor but off the watchlist: the watchlist rule leaves out real pre-token
  // protocols (versioned names aside, a $2.8B curator is not a wrapped product). Rankable
  // ones belong on the board too, by score, not by the list's accident — but only when
  // they pass the watchlist's own exclusion: a wrapped, staked or bridged product of a
  // token that already trades (WBTC, Binance staked ETH, USDT0) is not a launch, so
  // above the floor it is left out entirely. Below the floor the early radar keeps the
  // starter's wider rule: a small bridge or staking protocol can still be an early
  // launch, and its implied value is bounded by its small TVL.
  const aboveFloor = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isCleanLaunch(p) && p.tvl_usd >= snapshot.floor_usd);
  for (const p of aboveFloor) chosen.set(p.slug, p);
  // The early radar: rankable protocols below the floor, by implied value, not by TVL.
  // Scoring them first and cutting at BOARD_ROWS finds small protocols the market
  // already values highly for their category, which a TVL sort buries.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .map((p) => ({ p, score: impliedValue(p, snapshot.as_of, peers, stats, model) }))
    .sort((a, b) => b.score.implied - a.score.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0))
    .slice(0, Math.max(0, BOARD_ROWS - chosen.size))
    .map((s) => s.p);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const s = impliedValue(p, snapshot.as_of, peers, stats, model);
    return { p, ...s };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    watchlist: snapshot.watchlist.includes(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      // peer_ratio is stored unrounded: the dashboard recomputes the row from it,
      // and a rounded ratio would move a $500M implied value by thousands of dollars.
      peer_ratio: s.peerRatio,
      raw_peer_ratio: s.rawPeerRatio === null ? null : round4(s.rawPeerRatio),
      peer_count: s.peerCount,
      growth_pct: s.growthPct,
      rel_growth_pct: s.relGrowthPct,
      momentum_multiplier: round4(s.momentumMult),
      size_multiplier: round4(s.sizeMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      headroom_multiplier: round4(s.headroomMult),
      dominance_multiplier: round4(s.dominanceMult),
      // cat_median_change, cat_tokened_share and cat_share are stored unrounded,
      // like peer_ratio: the dashboard recomputes the row from them, and rounding
      // them would move a $500M implied value by hundreds of dollars.
      // cat_median_pre_token records whether that median is the category's pre-token
      // median or the all-protocol fallback, so the dashboard can say which.
      cat_median_change: s.catMedianChange,
      cat_median_pre_token: s.catMedianPreToken,
      cat_tokened_share: s.catTokenedShare,
      cat_share: s.catShare,
      age_days: s.age,
      confidence_multiplier: round4(s.confidenceMult),
      // missing_inputs names the snapshot inputs the row's score had to guess
      // (a 7d change, a listing date, or both), so the dashboard can say which.
      missing_inputs: s.missingInputs,
    },
    farm_steps: farmSteps(s.p, s.age, s.catShare).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How much a lending plan borrows against the capital supplied: a fifth of it, so
 *  the borrow always stays under the quarter the plan's own risk step demands.
 *  A fixed $20 borrow was 40% of a $50 supply and 8% of a $250 one. */
function borrowFor(capital: number): number {
  return Math.max(10, Math.round(capital * 0.2));
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Gas for one transaction on the protocol's main chain, as a farmer would actually pay it. */
function gasFor(chain: string): string {
  if (chain === 'Ethereum') return 'about $6 to $12 of gas per transaction';
  if (chain === 'Solana' || chain === 'Tron') return 'under $0.10 of gas per transaction';
  if (chain === 'Bitcoin') return 'about $2 to $5 of gas per transaction';
  return 'about $1 to $3 of gas per transaction';
}

/** Which family of farm action a category belongs to. No protocol name is special-cased. */
function familyOf(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateral')) return 'lending';
  if (c.includes('dex') || c.includes('liquidity manager')) return 'dex';
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return 'yield';
  if (c.includes('bridge')) return 'bridge';
  if (c.includes('staking') || c.includes('restak')) return 'staking';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('synthetic')) return 'derivatives';
  if (c.includes('prediction')) return 'prediction';
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return 'vault';
  if (c.includes('stable') || c.includes('rwa') || c.includes('basis')) return 'stable';
  if (c.includes('insurance')) return 'insurance';
  if (c.includes('launchpad')) return 'launchpad';
  return 'default';
}

/** The category's main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const name = p.name;
  switch (familyOf(p)) {
    case 'lending': return `Supply $${capital} of USDC to ${name} on ${chain}, then borrow $${borrowFor(capital)} of USDC against it so the position shows both sides.`;
    case 'dex': return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} in a band 20% above and below the pool's current price, and keep the position open.`;
    case 'yield': return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and leave the yield compounding.`;
    case 'bridge': return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds once inside its app.`;
    case 'staking': return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`;
    case 'derivatives': return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged position, under 2x leverage.`;
    case 'prediction': return `Fund $${capital} on ${name} on ${chain} and place one market position of $10 or more.`;
    case 'vault': return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares for the full hold period.`;
    case 'stable': return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the protocol.`;
    case 'insurance': return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
    case 'launchpad': return `Stake $${capital} on ${name} on ${chain} to qualify for its next sale, and vote in one sale.`;
    default: return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  }
}

/** The category's weekly recurring action. */
function weeklyFor(p: SnapshotProtocol, capital: number, chain: string): string {
  switch (familyOf(p)) {
    case 'lending': return `Each week, repay a quarter of the borrow and re-supply the same amount, so the position shows fresh activity without new capital.`;
    case 'dex': return `Each week, swap $10 through ${p.name} on ${chain} and collect the fees the pool pays out.`;
    case 'yield': return `Each week, claim the vault yield on ${chain} and re-deposit it instead of withdrawing it.`;
    case 'bridge': return `Each month, bridge $25 of USDC through ${p.name} to ${chain} and back, keeping the route active.`;
    case 'staking': return `Each week, check the staking rewards on ${chain} and restake them instead of claiming them out.`;
    case 'derivatives': return `Each week, close and reopen the small hedge on ${chain} so the account shows a fresh trade.`;
    case 'prediction': return `Each week, settle one market position on ${p.name} and open the next one with $10.`;
    case 'vault': return `Each week, add $10 to the ${p.name} vault on ${chain} so deposits arrive in more than one snapshot.`;
    case 'stable': return `Each week, move $10 of the stable asset in or out through ${p.name} on ${chain}.`;
    case 'insurance': return `Each month, renew or top up the cover on ${p.name} so the policy never lapses.`;
    case 'launchpad': return `Each week, vote in one sale or governance poll on ${p.name} on ${chain}.`;
    default: return `Each week, make one qualifying action on ${p.name} on ${chain}, such as a deposit, a swap or a vote.`;
  }
}

/** The category's main risk, stated plainly so the plan is not a slogan. */
function riskFor(p: SnapshotProtocol, capital: number, chain: string): string {
  switch (familyOf(p)) {
    case 'lending': return `Risk: a sharp price fall can liquidate the $${borrowFor(capital)} borrow, so keep the borrow at a fifth of the $${capital} supply and never borrow the same asset you supplied.`;
    case 'dex': return `Risk: the pool's price can move outside the ±20% band around the price you entered at and stop earning fees, so check the band weekly and reset it once if it drifts.`;
    case 'yield': return `Risk: the vault's strategy can lose value in a fast market, so treat the $${capital} as at-risk capital and never farm with money you need back.`;
    case 'bridge': return `Risk: a bridge can pause withdrawals, so never bridge more than the $${capital} at once and keep a second route off ${chain} in mind.`;
    case 'staking': return `Risk: the staking asset can fall while it is locked, so the $${capital} can be worth less when you unstake than when you staked it.`;
    case 'derivatives': return `Risk: leverage can liquidate the $${capital} margin in one move, so stay under 2x and set the position's stop before you open it.`;
    case 'prediction': return `Risk: a market position can go to zero, so cap each position at $10 and never chase a loss with a bigger one.`;
    case 'vault': return `Risk: a vault's curator can change strategy, so read the vault's own page each month and exit if its mandate changes.`;
    case 'stable': return `Risk: the stable asset can depeg, so check its price against $1.00 before each deposit and pause if it slips.`;
    case 'insurance': return `Risk: a claim can be refused if the cover's terms are missed, so read the policy's exclusions before you pay.`;
    case 'launchpad': return `Risk: a sale allocation is never guaranteed, so the $${capital} stake is a qualifier, not a purchase.`;
    default: return `Risk: the protocol is unaudited in places you cannot see, so the $${capital} is at-risk capital and a contract bug could lose it.`;
  }
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age, and its share of
 * its category's TVL), never from a hand-written list of names. The main action names
 * the protocol's share of its category so the farmer can see how central it is; the
 * hold step states how long the protocol has already run with no token; the last two
 * steps say what to do when the token actually launches, and what can go wrong.
 * radar-5 fixes two places where the farm plan's own numbers disagreed with
 * themselves: a DEX plan told the farmer to provide liquidity "in the $40-$60
 * range", a fixed dollar range that is meaningless for an arbitrary pool —
 * the range is now a band 20% above and below the pool's current price, in
 * both the action and the risk step; and a lending plan told the farmer to
 * borrow a fixed $20 against a $50 supply (40% of it) while its own risk
 * step said to keep the borrow under a quarter of the supply — the borrow is
 * now a fifth of the capital supplied ($10 on $50, $20 on $100, $30 on $150,
 * $50 on $250), the weekly step repays a quarter of that borrow, and the
 * risk step states the fifth, so the three steps finally agree.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, catShare: number): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const cat = p.category ?? 'its category';
  const shareText = catShare >= 0.005
    ? `It holds about ${Math.round(catShare * 100)}% of all ${cat} TVL.`
    : `It holds under 1% of all ${cat} TVL.`;
  const ageText = age === null
    ? `Its listing date is not in the snapshot, so use the default ${hold}-day hold.`
    : `The protocol has already run ${age} days with no token.`;
  return [
    {
      text: `Use a fresh wallet that holds only the $${capital} you plan to farm, and keep its seed phrase offline on paper. Farm on ${chain}${p.chains.length > 1 ? `, the first of its ${p.chains.length} chains` : ''}.`,
      cost: gas,
      time: '5 minutes',
    },
    {
      text: `${actionFor(p, capital, chain)} ${shareText}`,
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyFor(p, capital, chain),
      cost: gas,
      time: '10 minutes a week',
    },
    {
      text: `${ageText} Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and check the protocol's own points or rewards page each month, claiming only from the link it publishes.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `When a token launches, claim only from the link ${p.name} itself publishes on its own page, never from a reply, an ad or a direct message, and never pay a fee to claim. Unstake or withdraw the $${capital} after the snapshot date the protocol names, or after the ${hold}-day hold if it names none.`,
      cost: 'nothing to claim, and never pay a claim fee',
      time: '15 minutes when the launch is announced',
    },
    {
      text: riskFor(p, capital, chain),
      cost: 'nothing to read, and never pay to claim',
      time: '10 minutes to read',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, farm plan included. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    watchlist: row.watchlist,
    peer_ratio: row.model.peer_ratio,
    raw_peer_ratio: row.model.raw_peer_ratio,
    peer_count: row.model.peer_count,
    momentum_multiplier: row.model.momentum_multiplier,
    size_multiplier: row.model.size_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    headroom_multiplier: row.model.headroom_multiplier,
    dominance_multiplier: row.model.dominance_multiplier,
    rel_growth_pct: row.model.rel_growth_pct,
    cat_median_change: row.model.cat_median_change,
    cat_median_pre_token: row.model.cat_median_pre_token,
    cat_tokened_share: row.model.cat_tokened_share,
    cat_share: row.model.cat_share,
    confidence_multiplier: row.model.confidence_multiplier,
    missing_inputs: row.model.missing_inputs,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const peers = peerRatios(snapshot, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const peerTable: PeerRatio[] = [...peers.byCategory.entries()]
    .map(([category, v]) => ({ category, ratio: round4(v.ratio), raw_ratio: v.raw === null ? null : round4(v.raw), peers: v.peers }))
    .sort((a, b) => b.peers - a.peers);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    full_data_rows: board.filter((r) => r.model.missing_inputs.length === 0).length,
    global_peer_ratio: round4(peers.global),
    peer_ratios: peerTable,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
