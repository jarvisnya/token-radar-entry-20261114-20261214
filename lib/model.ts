// Token Radar, model radar-4: one sealed snapshot in, one ranked board out.
//
// The board covers every rankable pre-token protocol in the snapshot: 198
// rows on this snapshot — the whole 40-protocol watchlist, the 138 rankable
// protocols below the $50M floor, and the 20 rankable protocols at or above
// the floor that the watchlist leaves out (flagged off-list, priced with the
// same model and no invented haircut: the house leaves them out only for
// its parentProtocol rule, which is not a field of the snapshot, and the
// board says so rather than hiding them). A protocol is pre-token when its
// record carries no token at all (no market cap, no CoinGecko id, no
// symbol); live-token protocols are kept apart and shown with the market's
// own values, never mixed into the ranked board. Rankable means pre-token,
// not an exchange (CEX) and not a versioned pool (a name ending in V2, v2,
// 2.0 and the like), and not a wrapped, staked or bridged product of a
// token that already trades: the watchlist's own rule, applied to every
// row. A bridge, a liquid-staking or restaking product, a name carrying the
// whole word wrapped, staked or staking, or a name beginning with an
// exchange's name is a product of a token that exists, not a protocol still
// waiting on a launch of its own — WBTC is Bitcoin on Ethereum, Binance
// staked ETH is ETH in Binance's staking product, and neither belongs on
// this board.
//
// Every term of radar-4 is fitted on the snapshot's own protocols and
// tested held-out. The numbers the dashboard publishes are the ones this
// run computed, not constants chosen by hand:
//
//   fitted value = exp(a + b x ln(TVL)) x exp(category residual), the size
//     curve of market cap on TVL fitted by least squares on the 94 live
//     protocols with a positive market cap (b = 0.40 on this snapshot: a
//     protocol ten times larger trades at about 0.40x the multiple, so a
//     flat multiple would overvalue the giants by an order of magnitude).
//     The category residual is the median log-residual of the live
//     protocols in the category, shrunk toward zero (weight 3), and only
//     for categories with at least 5 live peers; thin categories fall back
//     to the global curve. The fitted multiple is clamped to [0.01, 0.60].
//   odds = a logistic regression on the 437 peers with an age — the
//     rankable pre-token protocols and the live real-category protocols
//     that carry a listed date — with features years listed, ln TVL and
//     7-day change, standardized, fitted by gradient descent, plus a
//     shrunk category log-odds offset (a category whose peers launch
//     more often than the regression expects lifts its protocols' odds).
//     On this snapshot the odds rise with age and size and fall with
//     growth, the same directions as the top entry's published model. A
//     protocol with no listed date takes the global rate. The odds are
//     the peers' record, not a forecast: the page never says a token
//     will launch.
//   expected = fitted value x odds, the ranked number. The board ranks by
//     expected launch value and shows the fitted value, the odds and the
//     bootstrap range beside it, so a reader can see which half of the
//     number is size and which half is the chance a token ever lists.
//   verdict = FARM / MARGINAL / SKIP from the farm's own economics, not
//     from the odds alone: a deposit of 0.02% of TVL (clamped $100–
//     $50,000), a 7% drop share over 12 weeks, chain-aware gas (the
//     protocol's cheapest chain, $0.05 on Solana, $0.25 on the cheap
//     chains, $1 elsewhere, $3 on Ethereum alone — the 2026 level for
//     ordinary transactions, not the $8 a mainnet peak used to cost),
//     one setup transaction, one a week, two to unwind. The modelled
//     drop is expected value x drop share x deposit / TVL; the net is
//     the drop less the fees. FARM when the net beats both the T-bill
//     return on the deposit (4% a year) and $25 an hour of hands-on
//     work; SKIP when the fees cover the drop; else MARGINAL. The
//     dashboard's scenario controls recompute every verdict live from
//     the same arithmetic.
//   range = a prediction interval, not a parameter interval: the fitted
//     value times the 25th/75th (and 10th/90th) percentiles of the live
//     comps' leave-one-out log-residuals — a conformal interval, so the
//     printed P25–P75 says where the token would price if it missed by
//     a typical amount, measured on comps the fit never saw, not how
//     much the fitted value moves when the comps are resampled — that
//     spread is far narrower than the model's real miss (only 13% of
//     real caps fall inside the resampling range, so it would be a
//     dishonest range to print). The bootstrap (200 refits of the live
//     protocols, seeded) puts a rank range on every row instead, with
//     the odds held fixed, and the range honesty is measured
//     leave-one-out: each comp priced from a fit on the other 93, its
//     real cap checked against the interval the other 93 imply.
//
// What the held-out tests decided, and the model therefore does or does
// not do: the term evidence table (leave-one-out and walk-forward, the
// walk-forward fitting the protocols listed before 2024-07-15 and pricing
// the newer ones) keeps a term only when it lowers the held-out miss in
// both tests, a move under 1% on one test counting as flat. The size curve
// and the category effect survive; a 7-day growth term, an age term and a
// chain-count term inside the value fit do not — growth worsens both
// tests, age worsens both, chains helps leave-one-out a little and
// worsens the walk-forward. Age and growth still matter, in the odds,
// where their signal is strong. No protocol name is ever special-cased:
// the same functions score every row.
//
// The implied value is the entry's own claim, never make.fun's: it says
// what a token would be worth if the protocol's record stayed as it is. It
// does not predict whether or when a token is issued.

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

/** The model's constants, as the dashboard states them. The curve's slope
 * and intercept, the odds coefficients and every validation number are
 * fitted at run time from the snapshot, never constants. */
export interface ModelConstants {
  multiple_min: number;
  multiple_max: number;
  cat_resid_shrink: number;
  cat_resid_min_peers: number;
  odds_shrink: number;
  odds_buckets: Array<[number, number]>;
  odds_cat_shrink: number;
  range_widen: number;
  deposit_pct: number;
  deposit_min: number;
  deposit_max: number;
  drop_share: number;
  horizon_weeks: number;
  tbill_rate: number;
  hourly_bar_usd: number;
  gas_solana: number;
  gas_cheap: number;
  gas_other: number;
  gas_ethereum: number;
  bootstrap_refits: number;
  bootstrap_seed: number;
}

export const MODEL: ModelConstants = {
  multiple_min: 0.01,
  multiple_max: 0.6,
  cat_resid_shrink: 3,
  cat_resid_min_peers: 5,
  odds_shrink: 10,
  odds_buckets: [
    [0, 180],
    [180, 365],
    [365, 730],
    [730, 1095],
    [1095, Number.MAX_SAFE_INTEGER],
  ],
  odds_cat_shrink: 5,
  range_widen: 1.15,
  deposit_pct: 0.0002,
  deposit_min: 100,
  deposit_max: 50000,
  drop_share: 0.07,
  horizon_weeks: 12,
  tbill_rate: 0.04,
  hourly_bar_usd: 25,
  gas_solana: 0.05,
  gas_cheap: 0.25,
  gas_other: 1,
  gas_ethereum: 3,
  bootstrap_refits: 200,
  bootstrap_seed: 20261122,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-7';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The walk-forward split: protocols listed before this date price the newer ones. */
export const WALK_FORWARD_SPLIT = '2024-07-15';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. `implied_value_usd` is the
 * ranked number: the expected launch value, fitted value x odds. */
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
  age_days: number | null;
  off_list: boolean;
  watchlist: boolean;
  implied_value_usd: number;
  model: {
    fitted_value_usd: number;
    fitted_multiple: number;
    base_multiple: number;
    category_residual: number;
    category_peers: number;
    odds: number;
    odds_logit: number;
    odds_terms: [number, number, number, number];
    age_days: number | null;
  };
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  verdict_reason: string;
  deposit_usd: number;
  per_tx_usd: number;
  fees_usd: number;
  txs: number;
  hours: number;
  tbill_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  break_even_drop_share: number;
  break_even_odds: number;
  p25_usd: number;
  p75_usd: number;
  p10_usd: number;
  p90_usd: number;
  rank_lo: number;
  rank_hi: number;
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
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
  off_list: boolean;
  watchlist: boolean;
  implied_value_usd: number;
  fitted_value_usd: number;
  fitted_multiple: number;
  base_multiple: number;
  category_residual: number;
  category_peers: number;
  odds: number;
  odds_logit: number;
  odds_terms: [number, number, number, number];
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  verdict_reason: string;
  deposit_usd: number;
  per_tx_usd: number;
  fees_usd: number;
  txs: number;
  hours: number;
  tbill_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  break_even_drop_share: number;
  break_even_odds: number;
  p25_usd: number;
  p75_usd: number;
  p10_usd: number;
  p90_usd: number;
  rank_lo: number;
  rank_hi: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One value comp: a live-token protocol the size curve is fitted on, with
 * its leave-one-out fitted value, for the detail view's nearest-peers table. */
export interface CompRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
  loo_fitted_usd: number;
}

/** One age bucket's token odds, published so the reader can check it. */
export interface OddsRow {
  bucket: string;
  live: number;
  pre_token: number;
  raw_rate: number;
  odds: number;
}

/** The fitted size curve, published with its fit. */
export interface SizeFit {
  intercept: number;
  slope: number;
  live_protocols: number;
}

/** The fitted logistic odds model, published with its fit and its held-out score. */
export interface OddsModel {
  global_rate: number;
  peers: number;
  no_age_count: number;
  intercept: number;
  coefs: [number, number, number];
  means: [number, number, number];
  stds: [number, number, number];
  brier_base: number;
  brier_buckets_loo: number;
  brier_logistic_cv: number;
  brier_logistic_cat_cv: number;
  brier_logistic_wf: number;
  brier_logistic_cat_wf: number;
  brier_control_wf: number;
}

/** One term of the evidence table: the held-out miss with the term added to
 * the kept model so far, and whether the term was kept. */
export interface EvidenceTerm {
  term: string;
  loo: number;
  walk_forward: number;
  kept: boolean;
}

/** The term evidence: leave-one-out and walk-forward median absolute log
 * error of the fitted market cap, for each term added in order. */
export interface Evidence {
  walk_forward_split: string;
  walk_forward_train: number;
  walk_forward_test: number;
  terms: EvidenceTerm[];
}

/** How the snapshot's 758 protocols split into exactly one group each. */
export interface Accounting {
  total: number;
  ranked: number;
  watchlist: number;
  below_floor: number;
  off_list: number;
  already_token: number;
  set_aside: number;
  set_aside_groups: Array<{ group: string; count: number }>;
}

/** Whether the printed ranges are honest: the share of the live comps'
 * real market caps that fall inside the printed ranges, each comp priced
 * leave-one-out from a fit on the other 93 — and the same share
 * walk-forward: the comps listed before 2024-07-15 price the newer ones. */
export interface Honesty {
  n: number;
  p25_75: number;
  p10_90: number;
  wf_n: number;
  wf_p25_75: number;
  wf_p10_90: number;
}

/** The held-out test, split in half by slug and run twice: each half fitted,
 * the other half scored. Median absolute log error of the fitted market cap.
 * The Spearman ranks are the fitted value and the TVL alone against the
 * real market cap, on all 94 live comps. */
export interface Validation {
  value_half_a: number;
  value_half_b: number;
  radar2_half_a: number;
  radar2_half_b: number;
  spearman_fitted: number;
  spearman_tvl: number;
}

/** One set-aside pre-token protocol: the reason it is not ranked. */
export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  reason: string;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  watchlist_covered: number;
  board_size: number;
  early_size: number;
  off_list_size: number;
  live_size: number;
  size_fit: SizeFit;
  odds_model: OddsModel;
  odds_table: OddsRow[];
  validation: Validation;
  evidence: Evidence;
  odds_evidence: OddsEvidence;
  coeff_stability: CoeffStability;
  scatter_svg: string;
  accounting: Accounting;
  honesty: Honesty;
  checksum: string;
  verdict_counts: { FARM: number; MARGINAL: number; SKIP: number };
  total_fitted_usd: number;
  total_expected_usd: number;
  rows: RadarRow[];
  live: LiveRow[];
  comps: CompRow[];
  set_aside: SetAsideRow[];
  watchlist: string[];
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

/** The median of a non-empty list, else null. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** The mean of a list. */
function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** The population standard deviation of a list. */
function std(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/** The Spearman rank correlation of two series, ties averaged: how well
 * the ranking of one matches the ranking of the other. */
function spearman(a: number[], b: number[]): number {
  const rankOf = (v: number[]): number[] => {
    const order = v.map((x, i) => [x, i] as [number, number]).sort((p, q) => p[0] - q[0]);
    const ranks = new Array<number>(v.length).fill(0);
    let i = 0;
    while (i < order.length) {
      let j = i;
      while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) ranks[order[k]![1]] = avg;
      i = j + 1;
    }
    return ranks;
  };
  const ra = rankOf(a);
  const rb = rankOf(b);
  const n = a.length;
  const ma = mean(ra);
  const mb = mean(rb);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (ra[i]! - ma) * (rb[i]! - mb);
    sxx += (ra[i]! - ma) ** 2;
    syy += (rb[i]! - mb) ** 2;
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
}

/** A quantile of a sorted list, linear interpolation, deterministic. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
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

/** Categories that are a wrapped, staked or bridged product by definition. */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name carrying the whole word wrapped, staked or staking. */
const WRAPPED_NAME = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool, and not a wrapped, staked or bridged product of a token that already trades. */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !WRAPPED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_NAME.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The live-token protocols the model learns from: real protocols whose
 * token already trades, with a positive market cap. Exchanges are left out
 * because an exchange token prices the exchange, not a protocol's TVL, and
 * wrapped, staked and bridged products because their market cap is another
 * token's. A zero market cap carries no information about value. */
export function liveProtocols(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => !isPreToken(p) && p.category !== 'CEX' && !WRAPPED_CATEGORIES.has(p.category ?? '') && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
}

/** The live-token protocols in real categories, whether or not their token
 * carries a usable market cap: the peers the odds model learns from. */
export function liveRealProtocols(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => !isPreToken(p) && p.category !== 'CEX' && !WRAPPED_CATEGORIES.has(p.category ?? ''));
}

/** Least squares for y = a + b x. */
function ols2(xs: number[], ys: number[]): { intercept: number; slope: number } {
  const n = xs.length;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return { intercept: my - slope * mx, slope };
}

/** Solve a small linear system by Gauss-Jordan with partial pivoting. */
function solveLinear(A: number[][], v: number[]): number[] {
  const n = v.length;
  const M = A.map((row, i) => [...row, v[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    const tmp = M[c]!;
    M[c] = M[piv]!;
    M[piv] = tmp;
    if (Math.abs(M[c]![c]!) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / M[c]![c]!;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((row, i) => (Math.abs(row[i]!) < 1e-12 ? 0 : row[n]! / row[i]!));
}

/** Least squares for y on a row of features (first feature is the intercept when present). */
function olsMulti(rows: number[][], ys: number[]): number[] {
  const k = rows[0]!.length;
  const A: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const v: number[] = new Array<number>(k).fill(0);
  for (let i = 0; i < rows.length; i++) {
    for (let a = 0; a < k; a++) {
      v[a]! += rows[i]![a]! * ys[i]!;
      for (let c = 0; c < k; c++) A[a]![c]! += rows[i]![a]! * rows[i]![c]!;
    }
  }
  return solveLinear(A, v);
}

/** The fitted size curve and its category residuals, from one set of live
 * protocols. The residual of a category is the median log-residual of its
 * live protocols, shrunk toward zero (weight `cat_resid_shrink`), and only
 * for categories with at least `cat_resid_min_peers` live peers. */
export interface SizeCurve {
  intercept: number;
  slope: number;
  residuals: Map<string, { residual: number; peers: number }>;
}

export function fitSizeCurve(live: SnapshotProtocol[], model: ModelConstants = MODEL): SizeCurve {
  const fit = ols2(
    live.map((p) => Math.log(p.tvl_usd)),
    live.map((p) => Math.log(p.mcap_usd!)),
  );
  const byCat = new Map<string, number[]>();
  for (const p of live) {
    const r = Math.log(p.mcap_usd!) - (fit.intercept + fit.slope * Math.log(p.tvl_usd));
    const key = p.category ?? 'Uncategorised';
    const list = byCat.get(key) ?? [];
    list.push(r);
    byCat.set(key, list);
  }
  const residuals = new Map<string, { residual: number; peers: number }>();
  for (const [key, list] of byCat) {
    if (list.length < model.cat_resid_min_peers) continue;
    residuals.set(key, {
      residual: (list.length * (median(list) ?? 0)) / (list.length + model.cat_resid_shrink),
      peers: list.length,
    });
  }
  return { ...fit, residuals };
}

/** The fitted market cap one protocol gets from the size curve: its TVL
 * priced at the multiple the curve gives a protocol that size, shifted by
 * its category's residual. The multiple is clamped to the model's guardrails.
 * The base multiple is the curve's multiple before the category shift. */
export function predictFitted(
  protocol: SnapshotProtocol,
  curve: SizeCurve,
  model: ModelConstants = MODEL,
): { fitted: number; multiple: number; baseMultiple: number; catResidual: number; catPeers: number } {
  const hit = curve.residuals.get(protocol.category ?? 'Uncategorised');
  const catResidual = hit === undefined ? 0 : hit.residual;
  const catPeers = hit === undefined ? 0 : hit.peers;
  const logBase = curve.intercept + curve.slope * Math.log(Math.max(1, protocol.tvl_usd));
  const baseMultiple = Math.min(model.multiple_max, Math.max(model.multiple_min, Math.exp(logBase) / Math.max(1, protocol.tvl_usd)));
  const logFitted = logBase + catResidual;
  const raw = Math.exp(logFitted);
  const multiple = Math.min(model.multiple_max, Math.max(model.multiple_min, raw / Math.max(1, protocol.tvl_usd)));
  return { fitted: Math.max(1, Math.round(protocol.tvl_usd * multiple)), multiple: round4(multiple), baseMultiple: round4(baseMultiple), catResidual: round4(catResidual), catPeers };
}

// ---------------------------------------------------------------- odds

/** The odds model's peers: rankable pre-token protocols and live
 * real-category protocols that carry a listed date, sorted by slug so
 * every fold and every resample is deterministic. */
export function oddsPeers(snapshot: Snapshot): SnapshotProtocol[] {
  const rankable = snapshot.protocols.filter((p) => isRankable(p) && p.listed_at !== null);
  const live = liveRealProtocols(snapshot).filter((p) => p.listed_at !== null);
  return [...rankable, ...live].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

export interface OddsFit {
  global: number;
  intercept: number;
  coefs: [number, number, number];
  means: [number, number, number];
  stds: [number, number, number];
  growthMean: number;
  /** The shrunk category offset, by category: the mean surprise of the
   * category's peers (outcome less predicted odds), shrunk toward zero.
   * A protocol's odds add its category's offset to the logistic logit. */
  cat_offsets: Record<string, number>;
}

function sigmoid(t: number): number {
  return 1 / (1 + Math.exp(-t));
}

/** The logistic odds model, fitted by full-batch gradient descent on the
 * 437 peers with an age: features standardized, learning rate 0.05, 2000
 * iterations, intercept started at the log-odds of the global rate. The
 * fit then adds a shrunk category offset (see OddsFit): each category's
 * mean surprise — how often its peers launched, less the odds the
 * regression gave them — so a category whose peers launch more often than
 * the regression expects lifts its protocols' odds, and one that launches
 * less often lowers them. The offset is the raw mean surprise, not the
 * variance-scaled logit residual radar-5 used: scaling by 1/(p(1-p))
 * let a single extreme category move a giant's odds by a full logit,
 * which the dev board punished. */
export function fitOdds(snapshot: Snapshot, model: ModelConstants = MODEL): OddsFit {
  const peers = oddsPeers(snapshot);
  const ys = peers.map((p) => (isPreToken(p) ? 0 : 1));
  const global = mean(ys);
  const growthMean = mean(peers.filter((p) => p.change_7d !== null).map((p) => p.change_7d! / 100));
  const X = peers.map((p) => {
    const a = ageDays(snapshot.as_of, p.listed_at);
    return [a === null ? 0 : a / 365, Math.log(p.tvl_usd), p.change_7d === null ? growthMean : p.change_7d / 100] as [number, number, number];
  });
  const means = [0, 1, 2].map((i) => mean(X.map((r) => r[i]!))) as [number, number, number];
  const stds = [0, 1, 2].map((i) => std(X.map((r) => r[i]!)) || 1) as [number, number, number];
  const Z = X.map((r) => r.map((v, i) => (v - means[i]!) / stds[i]!) as [number, number, number]);
  let b: [number, number, number, number] = [Math.log(global / (1 - global)), 0, 0, 0];
  for (let it = 0; it < 2000; it++) {
    const g = [0, 0, 0, 0];
    for (let i = 0; i < Z.length; i++) {
      const z = Z[i]!;
      const e = sigmoid(b[0] + b[1] * z[0]! + b[2] * z[1]! + b[3] * z[2]!) - ys[i]!;
      g[0]! += e;
      g[1]! += e * z[0]!;
      g[2]! += e * z[1]!;
      g[3]! += e * z[2]!;
    }
    for (let j = 0; j < 4; j++) b[j]! -= 0.05 * g[j]! / Z.length;
  }
  const fit: OddsFit = { global: round4(global), intercept: round4(b[0]), coefs: [round4(b[1]), round4(b[2]), round4(b[3])], means: [round4(means[0]), round4(means[1]), round4(means[2])], stds: [round4(stds[0]), round4(stds[1]), round4(stds[2])], growthMean: round4(growthMean), cat_offsets: {} };
  // The category offset, from the fitted model itself: each peer's
  // surprise (its outcome less its predicted odds), averaged within its
  // category and shrunk toward zero by n/(n+odds_cat_shrink). Computed
  // from the rounded coefficients, so oddsFor reproduces exactly these
  // offsets.
  const byCat = new Map<string, number[]>();
  for (let i = 0; i < peers.length; i++) {
    const z = Z[i]!;
    const pr = sigmoid(fit.intercept + fit.coefs[0] * z[0]! + fit.coefs[1] * z[1]! + fit.coefs[2] * z[2]!);
    const r = ys[i]! - pr;
    const key = peers[i]!.category ?? 'Uncategorised';
    const list = byCat.get(key) ?? [];
    list.push(r);
    byCat.set(key, list);
  }
  for (const [key, list] of byCat) {
    fit.cat_offsets[key] = round4((list.length * mean(list)) / (list.length + model.odds_cat_shrink));
  }
  return fit;
}

/** The token odds one protocol gets from the logistic model: the logit and
 * each term's contribution, so the detail view can show its working. The
 * terms are age, ln TVL, growth, and the category offset. A protocol with
 * no listed date takes the global rate. */
export function oddsFor(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: OddsFit,
): { odds: number; logit: number; terms: [number, number, number, number] } {
  const a = ageDays(asOf, protocol.listed_at);
  if (a === null) {
    const logit = Math.log(fit.global / (1 - fit.global));
    return { odds: fit.global, logit: round4(logit), terms: [0, 0, 0, 0] };
  }
  const raw: [number, number, number] = [a / 365, Math.log(protocol.tvl_usd), protocol.change_7d === null ? fit.growthMean : protocol.change_7d / 100];
  const terms: [number, number, number, number] = [
    round4(fit.coefs[0] * ((raw[0] - fit.means[0]) / fit.stds[0])),
    round4(fit.coefs[1] * ((raw[1] - fit.means[1]) / fit.stds[1])),
    round4(fit.coefs[2] * ((raw[2] - fit.means[2]) / fit.stds[2])),
    round4(fit.cat_offsets[protocol.category ?? 'Uncategorised'] ?? 0),
  ];
  const logit = fit.intercept + terms[0] + terms[1] + terms[2] + terms[3];
  return { odds: round4(sigmoid(logit)), logit: round4(logit), terms };
}

/** The age buckets' token odds on the odds peers: the share that already
 * has a token, by days since first tracked, shrunk toward the global rate.
 * Published so the reader can check the buckets against the logistic fit. */
export interface OddsCalibration {
  global: number;
  buckets: OddsRow[];
}

export function oddsCalibration(snapshot: Snapshot, model: ModelConstants = MODEL): OddsCalibration {
  const pop = oddsPeers(snapshot);
  const liveCount = pop.filter((p) => !isPreToken(p)).length;
  const global = pop.length === 0 ? 0 : liveCount / pop.length;
  const buckets: OddsRow[] = model.odds_buckets.map(([lo, hi]) => {
    const inBucket = pop.filter((p) => {
      const a = ageDays(snapshot.as_of, p.listed_at);
      return a !== null && a >= lo && a < hi;
    });
    const l = inBucket.filter((p) => !isPreToken(p)).length;
    const pr = inBucket.filter(isPreToken).length;
    const raw = inBucket.length === 0 ? global : l / inBucket.length;
    const odds = (inBucket.length * raw + model.odds_shrink * global) / (inBucket.length + model.odds_shrink);
    const label = hi === Number.MAX_SAFE_INTEGER ? `${Math.round(lo / 365)}y+` : lo === 0 ? `<${hi}d` : `${lo}-${hi}d`;
    return { bucket: label, live: l, pre_token: pr, raw_rate: round4(raw), odds: round4(odds) };
  });
  return { global: round4(global), buckets };
}

/** The Brier score of a set of predictions: the mean squared error against the 0/1 outcome. */
function brier(pred: number[], actual: number[]): number {
  return mean(pred.map((p, i) => (p - actual[i]!) ** 2));
}

/** The odds model's held-out scores: the base rate's Brier, the age
 * buckets' leave-one-out Brier, and the logistic model's 5-fold
 * cross-validated Brier (folds by slug order, deterministic) — plain and
 * with the shrunk category offset, which is fitted on each fold's train
 * peers only. */
export function oddsBrier(snapshot: Snapshot, fit: OddsFit): { base: number; buckets_loo: number; logistic_cv: number; logistic_cat_cv: number } {
  const peers = oddsPeers(snapshot);
  const ys = peers.map((p) => (isPreToken(p) ? 0 : 1));
  const global = mean(ys);
  const base = global * (1 - global);
  // Age buckets, leave-one-out: each peer scored by the bucket rate without itself.
  const bucketPred = peers.map((p, i) => {
    const a = ageDays(snapshot.as_of, p.listed_at)!;
    const rest = peers.filter((_, j) => j !== i);
    const restY = rest.map((q) => (isPreToken(q) ? 0 : 1));
    const g = mean(restY);
    const [lo, hi] = MODEL.odds_buckets.find(([l, h]) => a >= l && a < h)!;
    const inB = rest.filter((q) => {
      const aa = ageDays(snapshot.as_of, q.listed_at)!;
      return aa >= lo && aa < hi;
    });
    const raw = inB.length === 0 ? g : mean(inB.map((q) => (isPreToken(q) ? 0 : 1)));
    return (inB.length * raw + MODEL.odds_shrink * g) / (inB.length + MODEL.odds_shrink);
  });
  // Logistic, 5-fold cross-validation, plain and with the category offset.
  const cvPred: number[] = new Array(peers.length).fill(0);
  const cvCatPred: number[] = new Array(peers.length).fill(0);
  for (let f = 0; f < 5; f++) {
    const testIdx: number[] = [];
    const trainIdx: number[] = [];
    for (let i = 0; i < peers.length; i++) (i % 5 === f ? testIdx : trainIdx).push(i);
    const trainPeers = trainIdx.map((i) => peers[i]!);
    const trainY = trainIdx.map((i) => ys[i]!);
    const gMean = mean(trainPeers.filter((p) => p.change_7d !== null).map((p) => p.change_7d! / 100));
    const X = trainPeers.map((p) => {
      const a = ageDays(snapshot.as_of, p.listed_at);
      return [a === null ? 0 : a / 365, Math.log(p.tvl_usd), p.change_7d === null ? gMean : p.change_7d / 100] as [number, number, number];
    });
    const means = [0, 1, 2].map((i) => mean(X.map((r) => r[i]!))) as [number, number, number];
    const stds = [0, 1, 2].map((i) => std(X.map((r) => r[i]!)) || 1) as [number, number, number];
    const Z = X.map((r) => r.map((v, i) => (v - means[i]!) / stds[i]!) as [number, number, number]);
    const g0 = mean(trainY);
    let b: [number, number, number, number] = [Math.log(g0 / (1 - g0)), 0, 0, 0];
    for (let it = 0; it < 2000; it++) {
      const g = [0, 0, 0, 0];
      for (let i = 0; i < Z.length; i++) {
        const z = Z[i]!;
        const e = sigmoid(b[0] + b[1] * z[0]! + b[2] * z[1]! + b[3] * z[2]!) - trainY[i]!;
        g[0]! += e;
        g[1]! += e * z[0]!;
        g[2]! += e * z[1]!;
        g[3]! += e * z[2]!;
      }
      for (let j = 0; j < 4; j++) b[j]! -= 0.05 * g[j]! / Z.length;
    }
    for (const i of testIdx) {
      const p = peers[i]!;
      const a = ageDays(snapshot.as_of, p.listed_at);
      const raw: [number, number, number] = [a === null ? 0 : a / 365, Math.log(p.tvl_usd), p.change_7d === null ? gMean : p.change_7d / 100];
      const z = raw.map((v, k) => (v - means[k]!) / stds[k]!) as [number, number, number];
      cvPred[i] = sigmoid(b[0] + b[1] * z[0] + b[2] * z[1] + b[3] * z[2]);
    }
    // The category offset on this fold's train peers only: each train
    // peer's surprise under the fold's fit, averaged within its category
    // and shrunk toward zero.
    const byCat = new Map<string, number[]>();
    for (let i = 0; i < trainPeers.length; i++) {
      const z = Z[i]!;
      const pr = sigmoid(b[0] + b[1] * z[0]! + b[2] * z[1]! + b[3] * z[2]!);
      const r = trainY[i]! - pr;
      const key = trainPeers[i]!.category ?? 'Uncategorised';
      const list = byCat.get(key) ?? [];
      list.push(r);
      byCat.set(key, list);
    }
    const catOffsets: Record<string, number> = {};
    for (const [key, list] of byCat) catOffsets[key] = (list.length * mean(list)) / (list.length + MODEL.odds_cat_shrink);
    for (const i of testIdx) {
      const p = peers[i]!;
      const off = catOffsets[p.category ?? 'Uncategorised'] ?? 0;
      const logit = Math.log(cvPred[i]! / (1 - cvPred[i]!)) + off;
      cvCatPred[i] = sigmoid(logit);
    }
  }
  return { base: round4(base), buckets_loo: round4(brier(bucketPred, ys)), logistic_cv: round4(brier(cvPred, ys)), logistic_cat_cv: round4(brier(cvCatPred, ys)) };
}

/** One term of the odds evidence table: the 5-fold cross-validated and
 * walk-forward Brier with the term added to the kept model so far. */
export interface OddsEvidenceTerm {
  term: string;
  cv: number;
  walk_forward: number;
  kept: boolean;
}

/** The odds term evidence, plus the walk-forward Brier of the shipped
 * logistic model — plain, with the category offset, and with the control. */
export interface OddsEvidence {
  walk_forward_split: string;
  walk_forward_train: number;
  walk_forward_test: number;
  terms: OddsEvidenceTerm[];
  wf_logistic: number;
  wf_logistic_cat: number;
  wf_control: number;
}

/** A logistic odds fit on a chosen feature subset, with an optional
 * shrunk category offset and an optional seeded random feature (the
 * control). Features are standardized on the train peers; the fit is the
 * same gradient descent the shipped model uses (learning rate 0.05, 2000
 * iterations), warm-started from `warmB` when given. */
function fitLogisticMasked(
  train: SnapshotProtocol[],
  asOf: string,
  use: [boolean, boolean, boolean],
  useOffset: boolean,
  extraRandom: boolean,
  model: ModelConstants = MODEL,
  warmB: number[] | null = null,
  iters = 2000,
): { predict: (p: SnapshotProtocol) => number; coefs: number[] } {
  const gMean = mean(train.filter((p) => p.change_7d !== null).map((p) => p.change_7d! / 100));
  const feats = (p: SnapshotProtocol): number[] => {
    const a = ageDays(asOf, p.listed_at);
    const all = [a === null ? 0 : a / 365, Math.log(p.tvl_usd), p.change_7d === null ? gMean : p.change_7d / 100];
    const picked = all.filter((_, i) => use[i]!);
    if (extraRandom) {
      const seed = [...p.slug].reduce((s, c) => s + c.charCodeAt(0), 0);
      picked.push(mulberry32(seed)());
    }
    return picked;
  };
  const raw = train.map(feats);
  const k = raw[0]!.length;
  const means = raw[0]!.map((_, j) => mean(raw.map((r) => r[j]!)));
  const sds = raw[0]!.map((_, j) => std(raw.map((r) => r[j]!)) || 1);
  const Z = raw.map((r) => r.map((v, j) => (v - means[j]!) / sds[j]!));
  const Y = train.map((p) => (isPreToken(p) ? 0 : 1));
  const g0 = mean(Y);
  const b: number[] = warmB !== null ? [...warmB] : [Math.log(g0 / (1 - g0)), ...new Array<number>(k).fill(0)];
  for (let it = 0; it < iters; it++) {
    const g = new Array<number>(k + 1).fill(0);
    for (let i = 0; i < Z.length; i++) {
      const z = Z[i]!;
      let logit = b[0]!;
      for (let j = 0; j < k; j++) logit += b[j + 1]! * z[j]!;
      const e = sigmoid(logit) - Y[i]!;
      g[0]! += e;
      for (let j = 0; j < k; j++) g[j + 1]! += e * z[j]!;
    }
    for (let j = 0; j <= k; j++) b[j]! -= (0.05 * g[j]!) / Z.length;
  }
  const offsets = new Map<string, number>();
  if (useOffset) {
    const byCat = new Map<string, number[]>();
    for (let i = 0; i < train.length; i++) {
      const z = Z[i]!;
      let logit = b[0]!;
      for (let j = 0; j < k; j++) logit += b[j + 1]! * z[j]!;
      const r = Y[i]! - sigmoid(logit);
      const key = train[i]!.category ?? 'Uncategorised';
      const list = byCat.get(key) ?? [];
      list.push(r);
      byCat.set(key, list);
    }
    for (const [key, list] of byCat) offsets.set(key, (list.length * mean(list)) / (list.length + model.odds_cat_shrink));
  }
  const predict = (p: SnapshotProtocol): number => {
    const f = feats(p);
    const z = f.map((v, j) => (v - means[j]!) / sds[j]!);
    let logit = b[0]!;
    for (let j = 0; j < k; j++) logit += b[j + 1]! * z[j]!;
    logit += offsets.get(p.category ?? 'Uncategorised') ?? 0;
    return sigmoid(logit);
  };
  return { predict, coefs: b.slice(1) };
}

/** The odds term evidence: greedy forward selection, each candidate term
 * added to the kept features so far and scored 5-fold cross-validated and
 * walk-forward (peers listed before 2024-07-15 score the newer ones). A
 * term is kept only when it lowers the Brier in both tests; a move under
 * 1% on one test counts as flat. The control row adds a seeded random
 * feature to the kept model: it must not help either test. */
export function oddsEvidence(snapshot: Snapshot, model: ModelConstants = MODEL): OddsEvidence {
  const peers = oddsPeers(snapshot);
  const ys = peers.map((p) => (isPreToken(p) ? 0 : 1));
  const wfTrain = peers.filter((p) => p.listed_at !== null && p.listed_at < WALK_FORWARD_SPLIT);
  const wfTest = peers.filter((p) => p.listed_at !== null && p.listed_at >= WALK_FORWARD_SPLIT);
  const trainRate = mean(wfTrain.map((p) => (isPreToken(p) ? 0 : 1)));
  const wfBase = mean(wfTest.map((p) => (trainRate - (isPreToken(p) ? 0 : 1)) ** 2));
  const score = (use: [boolean, boolean, boolean], useOffset: boolean, extraRandom: boolean): { cv: number; wf: number } => {
    const cvPred: number[] = new Array<number>(peers.length).fill(0);
    for (let f = 0; f < 5; f++) {
      const testIdx: number[] = [];
      const trainIdx: number[] = [];
      for (let i = 0; i < peers.length; i++) (i % 5 === f ? testIdx : trainIdx).push(i);
      const fit = fitLogisticMasked(
        trainIdx.map((i) => peers[i]!),
        snapshot.as_of,
        use,
        useOffset,
        extraRandom,
        model,
      );
      for (const i of testIdx) cvPred[i] = fit.predict(peers[i]!);
    }
    const wfFit = fitLogisticMasked(wfTrain, snapshot.as_of, use, useOffset, extraRandom, model);
    return {
      cv: round4(brier(cvPred, ys)),
      wf: round4(brier(wfTest.map((p) => wfFit.predict(p)), wfTest.map((p) => (isPreToken(p) ? 0 : 1)))),
    };
  };
  const terms: OddsEvidenceTerm[] = [];
  let keptScore = { cv: round4(mean(ys) * (1 - mean(ys))), wf: round4(wfBase) };
  terms.push({ term: 'base rate alone', cv: keptScore.cv, walk_forward: keptScore.wf, kept: false });
  let keptUse: [boolean, boolean, boolean] = [false, false, false];
  let keptOffset = false;
  const candidates: Array<{ term: string; feature: 0 | 1 | 2 | 'offset' }> = [
    { term: '+ age, years listed', feature: 0 },
    { term: '+ size, ln TVL', feature: 1 },
    { term: '+ 7-day TVL growth', feature: 2 },
    { term: '+ category offset (raw surprise)', feature: 'offset' },
  ];
  for (const c of candidates) {
    const use: [boolean, boolean, boolean] = [...keptUse];
    let useOffset = keptOffset;
    if (c.feature === 'offset') useOffset = true;
    else use[c.feature] = true;
    const s = score(use, useOffset, false);
    const dCv = (keptScore.cv - s.cv) / keptScore.cv;
    const dWf = (keptScore.wf - s.wf) / keptScore.wf;
    const isKept = dCv >= -0.01 && dWf >= -0.01 && (dCv > 0.01 || dWf > 0.01);
    terms.push({ term: c.term, cv: s.cv, walk_forward: s.wf, kept: isKept });
    if (isKept) {
      keptScore = s;
      keptUse = use;
      keptOffset = useOffset;
    }
  }
  const control = score(keptUse, keptOffset, true);
  terms.push({ term: '+ control: random feature', cv: control.cv, walk_forward: control.wf, kept: false });
  const plain = score([true, true, true], false, false);
  const withCat = score([true, true, true], true, false);
  return {
    walk_forward_split: WALK_FORWARD_SPLIT,
    walk_forward_train: wfTrain.length,
    walk_forward_test: wfTest.length,
    terms,
    wf_logistic: plain.wf,
    wf_logistic_cat: withCat.wf,
    wf_control: control.wf,
  };
}

/** How stable the fitted coefficients are under resampling: the size
 * curve refitted on 200 bootstrap resamples of the live comps, the odds
 * coefficients on 100 resamples of the odds peers (warm-started from the
 * full fit, 300 iterations). Sign-held is the share of refits whose
 * coefficient keeps the full fit's sign. */
export interface CoeffStability {
  refits: number;
  odds_refits: number;
  size_slope_mean: number;
  size_slope_sd: number;
  size_intercept_mean: number;
  size_intercept_sd: number;
  odds_coef_mean: [number, number, number];
  odds_coef_sd: [number, number, number];
  odds_sign_held: [number, number, number];
}

export function coeffStability(snapshot: Snapshot, model: ModelConstants = MODEL): CoeffStability {
  const live = liveProtocols(snapshot);
  const peers = oddsPeers(snapshot);
  const rng = mulberry32(model.bootstrap_seed);
  const slopes: number[] = [];
  const intercepts: number[] = [];
  for (let b = 0; b < model.bootstrap_refits; b++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < live.length; i++) sample.push(live[Math.floor(rng() * live.length)]!);
    const c = fitSizeCurve(sample, model);
    slopes.push(c.slope);
    intercepts.push(c.intercept);
  }
  const full = fitOdds(snapshot, model);
  const warm: number[] = [full.intercept, ...full.coefs];
  const oddsRefits = 100;
  const coefSamples: number[][] = [[], [], []];
  for (let b = 0; b < oddsRefits; b++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < peers.length; i++) sample.push(peers[Math.floor(rng() * peers.length)]!);
    const fit = fitLogisticMasked(sample, snapshot.as_of, [true, true, true], false, false, model, warm, 300);
    fit.coefs.forEach((c, j) => coefSamples[j]!.push(c));
  }
  const sdOf = (xs: number[]): number => {
    const m = mean(xs);
    return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  };
  return {
    refits: model.bootstrap_refits,
    odds_refits: oddsRefits,
    size_slope_mean: round4(mean(slopes)),
    size_slope_sd: round4(sdOf(slopes)),
    size_intercept_mean: round4(mean(intercepts)),
    size_intercept_sd: round4(sdOf(intercepts)),
    odds_coef_mean: [round4(mean(coefSamples[0]!)), round4(mean(coefSamples[1]!)), round4(mean(coefSamples[2]!))],
    odds_coef_sd: [round4(sdOf(coefSamples[0]!)), round4(sdOf(coefSamples[1]!)), round4(sdOf(coefSamples[2]!))],
    odds_sign_held: [
      round4(coefSamples[0]!.filter((c) => Math.sign(c) === Math.sign(full.coefs[0])).length / oddsRefits),
      round4(coefSamples[1]!.filter((c) => Math.sign(c) === Math.sign(full.coefs[1])).length / oddsRefits),
      round4(coefSamples[2]!.filter((c) => Math.sign(c) === Math.sign(full.coefs[2])).length / oddsRefits),
    ],
  };
}

// ---------------------------------------------------------------- value evidence

/** One extra term's feature value for a protocol, with the train set's
 * means filling the gaps a missing date or change leaves. The fourth
 * feature is a control: a seeded random number, deterministic per slug,
 * that carries no signal — a term that helps only by chasing noise. */
function extraFeatures(p: SnapshotProtocol, asOf: string, growthMean: number, ageMean: number): [number, number, number, number] {
  const a = ageDays(asOf, p.listed_at);
  const seed = [...p.slug].reduce((s, c) => s + c.charCodeAt(0), 0);
  return [
    p.change_7d === null ? growthMean : p.change_7d / 100,
    a === null ? ageMean : a / 365,
    Math.log(Math.max(1, p.chains.length)),
    mulberry32(seed)(),
  ];
}

export interface ValueSpec {
  size: boolean;
  cat: boolean;
  extras: number[];
}

/** The log market cap one protocol gets from a value model spec fitted on
 * one train set: flat median multiple, the size curve, the shrunk category
 * residual, and any extra terms regressed on the residuals. */
function predictLogMcap(p: SnapshotProtocol, train: SnapshotProtocol[], asOf: string, spec: ValueSpec, model: ModelConstants = MODEL): number {
  const gMed = median(train.map((q) => q.mcap_usd! / q.tvl_usd)) ?? 0.2;
  if (!spec.size) return Math.log(p.tvl_usd * gMed);
  const fit = ols2(
    train.map((q) => Math.log(q.tvl_usd)),
    train.map((q) => Math.log(q.mcap_usd!)),
  );
  const byCat = new Map<string, number[]>();
  for (const q of train) {
    const r = Math.log(q.mcap_usd!) - (fit.intercept + fit.slope * Math.log(q.tvl_usd));
    const key = q.category ?? 'Uncategorised';
    const list = byCat.get(key) ?? [];
    list.push(r);
    byCat.set(key, list);
  }
  const residuals = new Map<string, number>();
  for (const [key, list] of byCat) {
    if (list.length < model.cat_resid_min_peers) continue;
    residuals.set(key, (list.length * (median(list) ?? 0)) / (list.length + model.cat_resid_shrink));
  }
  let lp = fit.intercept + fit.slope * Math.log(p.tvl_usd);
  if (spec.cat) lp += residuals.get(p.category ?? 'Uncategorised') ?? 0;
  if (spec.extras.length === 0) return lp;
  const growthMean = mean(train.filter((q) => q.change_7d !== null).map((q) => q.change_7d! / 100));
  const ageMean = mean(train.filter((q) => ageDays(asOf, q.listed_at) !== null).map((q) => ageDays(asOf, q.listed_at)! / 365));
  const resTrain = train.map((q) => {
    let l = fit.intercept + fit.slope * Math.log(q.tvl_usd);
    if (spec.cat) l += residuals.get(q.category ?? 'Uncategorised') ?? 0;
    return Math.log(q.mcap_usd!) - l;
  });
  const Xm = train.map((q) => [1, ...spec.extras.map((i) => extraFeatures(q, asOf, growthMean, ageMean)[i]!)]);
  const coef = olsMulti(Xm, resTrain);
  const xf = [1, ...spec.extras.map((i) => extraFeatures(p, asOf, growthMean, ageMean)[i]!)];
  return lp + coef.reduce((s, c, i) => s + c * xf[i]!, 0);
}

/** The term evidence table: greedy forward selection on the value model.
 * Each candidate term is added alone to the kept model so far and scored
 * leave-one-out and walk-forward; it is kept only when it lowers the
 * held-out miss in both tests, a move under 1% on one test counting as
 * flat. The numbers are this run's, computed from the snapshot. */
export function valueEvidence(snapshot: Snapshot, model: ModelConstants = MODEL): Evidence {
  const live = liveProtocols(snapshot).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const wfTrain = live.filter((p) => p.listed_at !== null && p.listed_at < WALK_FORWARD_SPLIT);
  const wfTest = live.filter((p) => p.listed_at !== null && p.listed_at >= WALK_FORWARD_SPLIT);
  const score = (spec: ValueSpec): { loo: number; wf: number } => {
    const looErr = live.map((p, i) => {
      const train = live.filter((_, j) => j !== i);
      return Math.abs(Math.log(p.mcap_usd!) - predictLogMcap(p, train, snapshot.as_of, spec, model));
    });
    const wfErr = wfTest.map((p) => Math.abs(Math.log(p.mcap_usd!) - predictLogMcap(p, wfTrain, snapshot.as_of, spec, model)));
    return { loo: round4(median(looErr) ?? 0), wf: round4(median(wfErr) ?? 0) };
  };
  const terms: EvidenceTerm[] = [];
  let keptScore = score({ size: false, cat: false, extras: [] });
  const candidates: Array<{ term: string; spec: ValueSpec }> = [
    { term: 'flat median multiple', spec: { size: false, cat: false, extras: [] } },
    { term: '+ size curve, ln TVL', spec: { size: true, cat: false, extras: [] } },
    { term: '+ category effect (median, n>=5)', spec: { size: true, cat: true, extras: [] } },
    { term: '+ 7-day TVL growth', spec: { size: true, cat: true, extras: [0] } },
    { term: '+ age, years listed', spec: { size: true, cat: true, extras: [1] } },
    { term: '+ chain count, ln', spec: { size: true, cat: true, extras: [2] } },
  ];
  // The first row is the baseline; the rest are candidates against the kept model.
  terms.push({ term: candidates[0]!.term, loo: keptScore.loo, walk_forward: keptScore.wf, kept: false });
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const s = score(c.spec);
    const dLoo = (keptScore.loo - s.loo) / keptScore.loo;
    const dWf = (keptScore.wf - s.wf) / keptScore.wf;
    const isKept = dLoo >= -0.01 && dWf >= -0.01 && (dLoo > 0.01 || dWf > 0.01);
    terms.push({ term: c.term, loo: s.loo, walk_forward: s.wf, kept: isKept });
    if (isKept) keptScore = s;
  }
  // The control: a seeded random feature, added to the kept model, must
  // not help either test. If it did, the tests themselves would be chasing noise.
  const control = score({ size: true, cat: true, extras: [3] });
  terms.push({ term: '+ control: random feature', loo: control.loo, walk_forward: control.wf, kept: false });
  return {
    walk_forward_split: WALK_FORWARD_SPLIT,
    walk_forward_train: wfTrain.length,
    walk_forward_test: wfTest.length,
    terms,
  };
}

/** The held-out test, split in half by slug and run twice: each half fitted,
 * the other half scored, for the value model (size curve + category
 * residual) and for radar-2's shrunk category median. Median absolute log error. */
export function validateModel(snapshot: Snapshot, model: ModelConstants = MODEL): Validation {
  const live = liveProtocols(snapshot).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const halfA = live.filter((_, i) => i % 2 === 0);
  const halfB = live.filter((_, i) => i % 2 === 1);
  const score = (train: SnapshotProtocol[], test: SnapshotProtocol[]): { v: number; r2: number } => {
    const curve = fitSizeCurve(train, model);
    const eV = test.map((p) => Math.abs(Math.log(p.mcap_usd!) - Math.log(predictFitted(p, curve, model).fitted)));
    const g = median(train.map((p) => p.mcap_usd! / p.tvl_usd)) ?? 0.2;
    const byCat = new Map<string, number[]>();
    for (const p of train) {
      const key = p.category ?? 'Uncategorised';
      const list = byCat.get(key) ?? [];
      list.push(p.mcap_usd! / p.tvl_usd);
      byCat.set(key, list);
    }
    const e2 = test.map((p) => {
      const list = byCat.get(p.category ?? 'Uncategorised') ?? [];
      const med = list.length > 0 ? median(list)! : g;
      const mult = Math.min(0.6, Math.max(0.05, (list.length * med + 3 * g) / (list.length + 3)));
      return Math.abs(Math.log(p.mcap_usd!) - Math.log(p.tvl_usd * mult));
    });
    return { v: median(eV) ?? 0, r2: median(e2) ?? 0 };
  };
  const ab = score(halfA, halfB);
  const ba = score(halfB, halfA);
  // The rank correlation on all 94 live comps: the fitted value and the
  // TVL alone against the real market cap.
  const curve = fitSizeCurve(live, model);
  const fitted = live.map((p) => predictFitted(p, curve, model).fitted);
  const actual = live.map((p) => p.mcap_usd!);
  const tvl = live.map((p) => p.tvl_usd);
  return {
    value_half_a: round4(ab.v),
    value_half_b: round4(ba.v),
    radar2_half_a: round4(ab.r2),
    radar2_half_b: round4(ba.r2),
    spearman_fitted: round4(spearman(fitted, actual)),
    spearman_tvl: round4(spearman(tvl, actual)),
  };
}

// ---------------------------------------------------------------- farm economics

/** The chains whose gas is $1 a transaction. */
const CHEAP_CHAINS = new Set(['Base', 'Arbitrum', 'Optimism', 'Plasma', 'Polygon', 'Binance', 'BSC']);

/** One transaction's gas on a protocol: its cheapest chain — Solana, then
 * the cheap chains, then any other chain, Ethereum alone last. */
export function gasPerTx(p: SnapshotProtocol, model: ModelConstants = MODEL): number {
  if (p.chains.includes('Solana')) return model.gas_solana;
  if (p.chains.some((c) => CHEAP_CHAINS.has(c))) return model.gas_cheap;
  if (p.chains.some((c) => c !== 'Ethereum')) return model.gas_other;
  return model.gas_ethereum;
}

/** The farm deposit: 0.02% of TVL, clamped to $100–$50,000. */
export function depositFor(p: SnapshotProtocol, model: ModelConstants = MODEL): number {
  return Math.min(model.deposit_max, Math.max(model.deposit_min, model.deposit_pct * p.tvl_usd));
}

/** The farm's scenario: the deposit share of TVL, the drop share of the
 * implied value, and the horizon in weeks. The dashboard's controls move
 * all three live; main.ts scores the defaults. */
export interface FarmScenario {
  deposit_pct: number;
  drop_share: number;
  horizon_weeks: number;
}

export function defaultScenario(model: ModelConstants = MODEL): FarmScenario {
  return { deposit_pct: model.deposit_pct, drop_share: model.drop_share, horizon_weeks: model.horizon_weeks };
}

/** The farm's economics for one protocol under one scenario: the deposit,
 * the fees, the modelled drop, the net, the T-bill return on the deposit,
 * the net per hour of hands-on work, and the break-evens. */
export interface FarmEconomics {
  deposit: number;
  per_tx: number;
  txs: number;
  fees: number;
  hours: number;
  drop: number;
  net: number;
  tbill: number;
  net_per_hour: number;
  break_even_drop_share: number;
  break_even_odds: number;
}

export function farmEconomics(
  p: SnapshotProtocol,
  fitted: number,
  odds: number,
  expected: number,
  scenario: FarmScenario,
  model: ModelConstants = MODEL,
): FarmEconomics {
  const deposit = Math.min(model.deposit_max, Math.max(model.deposit_min, scenario.deposit_pct * p.tvl_usd));
  const perTx = gasPerTx(p, model);
  const txs = 1 + scenario.horizon_weeks + 2;
  const fees = perTx * txs;
  const hours = (30 + 10 * scenario.horizon_weeks + 25) / 60;
  const drop = expected * scenario.drop_share * (deposit / p.tvl_usd);
  const net = drop - fees;
  const tbill = deposit * model.tbill_rate * (scenario.horizon_weeks / 52);
  const netPerHour = net / hours;
  const breakEvenDrop = expected * (deposit / p.tvl_usd) === 0 ? 1 : fees / (expected * (deposit / p.tvl_usd));
  const breakEvenOdds = fitted * scenario.drop_share * (deposit / p.tvl_usd) === 0 ? 1 : fees / (fitted * scenario.drop_share * (deposit / p.tvl_usd));
  return {
    deposit: round2(deposit),
    per_tx: perTx,
    txs,
    fees: round2(fees),
    hours: round2(hours),
    drop: round2(drop),
    net: round2(net),
    tbill: round2(tbill),
    net_per_hour: round2(netPerHour),
    break_even_drop_share: round4(Math.min(1, Math.max(0, breakEvenDrop))),
    break_even_odds: round4(Math.min(1, Math.max(0, breakEvenOdds))),
  };
}

/** The farm verdict from the economics: FARM when the net beats both the
 * T-bill return on the deposit and $25 an hour of hands-on work, SKIP when
 * the fees cover the modelled drop, else MARGINAL. The reason names the
 * numbers the verdict came from. */
export function verdictFor(e: FarmEconomics, model: ModelConstants = MODEL): { verdict: 'FARM' | 'MARGINAL' | 'SKIP'; reason: string } {
  const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;
  let verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  let reason: string;
  if (e.fees >= e.drop) {
    verdict = 'SKIP';
    reason = `Fees ${money(e.fees)} cover the modelled drop ${money(e.drop)}: the farm pays the chains more than the launch pays you.`;
  } else if (e.net > e.tbill && e.net_per_hour > model.hourly_bar_usd) {
    verdict = 'FARM';
    reason = `Net ${money(e.net)} beats the ${money(e.tbill)} a T-bill pays on a ${money(e.deposit)} deposit, at ${money(e.net_per_hour)}/hour over the $${model.hourly_bar_usd} bar (drop ${money(e.drop)}, fees ${money(e.fees)}).`;
  } else if (e.net > e.tbill) {
    verdict = 'MARGINAL';
    reason = `Net ${money(e.net)} beats the ${money(e.tbill)} a T-bill pays, but ${money(e.net_per_hour)}/hour is under the $${model.hourly_bar_usd} bar for ${e.hours.toFixed(1)} hours of work.`;
  } else if (e.net > 0) {
    verdict = 'MARGINAL';
    reason = `Net ${money(e.net)} is positive, but under the ${money(e.tbill)} a T-bill pays on a ${money(e.deposit)} deposit: the money earns more parked.`;
  } else {
    verdict = 'MARGINAL';
    reason = `Net ${money(e.net)} is under water once the ${money(e.fees)} of fees come off the ${money(e.drop)} drop: farm it only if you value the option itself.`;
  }
  return { verdict, reason };
}

// ---------------------------------------------------------------- bootstrap

/** A seeded PRNG (mulberry32): the bootstrap's only source of randomness,
 * so the two main.ts runs print the same bytes. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The FNV-1a 32-bit checksum of a string, as eight hex digits. The page
 * recomputes it over the rows it was handed and compares it with the one
 * main.ts wrote, so a hand-edited board cannot pass the integrity strip. */
export function fnv1aHex(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export interface ScoredRow {
  p: SnapshotProtocol;
  fitted: number;
  multiple: number;
  baseMultiple: number;
  catResidual: number;
  catPeers: number;
  odds: number;
  logit: number;
  terms: [number, number, number, number];
  expected: number;
  offList: boolean;
  watchlist: boolean;
}

/** The bootstrap: 200 refits of the size curve on resampled live protocols
 * (seeded), the odds held fixed, giving every row a rank range across the
 * refits. The value ranges come from the residuals instead (see
 * predictionRanges): the resampling spread is far narrower than the
 * model's real miss, so it would be a dishonest range to print. */
export function bootstrap(
  scored: ScoredRow[],
  comps: SnapshotProtocol[],
  model: ModelConstants = MODEL,
): { rankLo: number[]; rankHi: number[] } {
  const rng = mulberry32(model.bootstrap_seed);
  const n = scored.length;
  const rankLo = new Array<number>(n).fill(Number.MAX_SAFE_INTEGER);
  const rankHi = new Array<number>(n).fill(0);
  for (let b = 0; b < model.bootstrap_refits; b++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rng() * comps.length)]!);
    const curve = fitSizeCurve(sample, model);
    const exp: number[] = new Array<number>(n);
    const fit: number[] = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const f = predictFitted(scored[i]!.p, curve, model);
      fit[i] = f.fitted;
      exp[i] = Math.max(1, Math.round(f.fitted * scored[i]!.odds));
    }
    const order = Array.from({ length: n }, (_, i) => i).sort((a, c) => {
      if (exp[c]! !== exp[a]!) return exp[c]! - exp[a]!;
      if (fit[c]! !== fit[a]!) return fit[c]! - fit[a]!;
      if (scored[c]!.p.tvl_usd !== scored[a]!.p.tvl_usd) return scored[c]!.p.tvl_usd - scored[a]!.p.tvl_usd;
      return scored[a]!.p.slug < scored[c]!.p.slug ? -1 : 1;
    });
    for (let r = 0; r < n; r++) {
      const i = order[r]!;
      if (r + 1 < rankLo[i]!) rankLo[i] = r + 1;
      if (r + 1 > rankHi[i]!) rankHi[i] = r + 1;
    }
  }
  return { rankLo, rankHi };
}

/** Each live comp's log market-cap residual under a size curve fitted
 * without it — the leave-one-out residuals, in comp order. They are the
 * model's honest miss: wider than the in-sample residuals, because no
 * comp's own cap pulls its own fit. */
export function looResiduals(live: SnapshotProtocol[], model: ModelConstants = MODEL): number[] {
  const out: number[] = [];
  for (let j = 0; j < live.length; j++) {
    const train = live.filter((_, i) => i !== j);
    const curve = fitSizeCurve(train, model);
    out.push(Math.log(live[j]!.mcap_usd!) - Math.log(predictFitted(live[j]!, curve, model).fitted));
  }
  return out;
}

/** The printed value ranges: a prediction interval. Each row's expected
 * value times the 25th/75th (and 10th/90th) percentiles of the leave-one-
 * out residuals — a conformal interval: the range says where the token
 * would price if it missed by a typical amount, measured on comps the
 * fit never saw. The quantiles are widened by range_widen (15%): the
 * unwidened band held only 48.9% of caps leave-one-out, under its nominal
 * 50%, so the printed band is widened until it holds a little more than
 * nominal, and the measured coverage is stated in the dashboard. */
export function predictionRanges(
  scored: ScoredRow[],
  comps: SnapshotProtocol[],
  model: ModelConstants = MODEL,
): { p25: number[]; p75: number[]; p10: number[]; p90: number[]; q25: number; q75: number; q10: number; q90: number } {
  const residuals = looResiduals(comps, model).sort((a, b) => a - b);
  const q25 = quantile(residuals, 0.25) * model.range_widen;
  const q75 = quantile(residuals, 0.75) * model.range_widen;
  const q10 = quantile(residuals, 0.1) * model.range_widen;
  const q90 = quantile(residuals, 0.9) * model.range_widen;
  const p25: number[] = [];
  const p75: number[] = [];
  const p10: number[] = [];
  const p90: number[] = [];
  for (const s of scored) {
    p25.push(Math.max(1, Math.round(s.expected * Math.exp(q25))));
    p75.push(Math.max(1, Math.round(s.expected * Math.exp(q75))));
    p10.push(Math.max(1, Math.round(s.expected * Math.exp(q10))));
    p90.push(Math.max(1, Math.round(s.expected * Math.exp(q90))));
  }
  return { p25, p75, p10, p90, q25: round4(q25), q75: round4(q75), q10: round4(q10), q90: round4(q90) };
}

/** Whether the printed ranges are honest, measured leave-one-out: each
 * comp priced from a fit on the other 93, its real market cap checked
 * against the interval the other 93 comps' leave-one-out residuals imply
 * — the same widened conformal interval the board prints, with that
 * comp's own residual left out of the quantile. */
export function rangeHonesty(snapshot: Snapshot, model: ModelConstants = MODEL): Honesty {
  const live = liveProtocols(snapshot);
  const loo = looResiduals(live, model);
  const k = model.range_widen;
  let in2575 = 0;
  let in1090 = 0;
  for (let j = 0; j < live.length; j++) {
    const p = live[j]!;
    const train = live.filter((_, i) => i !== j);
    const curve = fitSizeCurve(train, model);
    const looFitted = predictFitted(p, curve, model).fitted;
    const others = loo.filter((_, i) => i !== j).sort((a, b) => a - b);
    const cap = p.mcap_usd!;
    if (cap >= looFitted * Math.exp(k * quantile(others, 0.25)) && cap <= looFitted * Math.exp(k * quantile(others, 0.75))) in2575++;
    if (cap >= looFitted * Math.exp(k * quantile(others, 0.1)) && cap <= looFitted * Math.exp(k * quantile(others, 0.9))) in1090++;
  }
  // Walk-forward: the comps listed before the split price the newer ones,
  // against the train comps' own leave-one-out residuals, widened the same way.
  const pre = live.filter((p) => p.listed_at !== null && p.listed_at < WALK_FORWARD_SPLIT);
  const post = live.filter((p) => p.listed_at !== null && p.listed_at >= WALK_FORWARD_SPLIT);
  const wfCurve = fitSizeCurve(pre, model);
  const trainRes = pre
    .map((p) => Math.log(p.mcap_usd!) - Math.log(predictFitted(p, wfCurve, model).fitted))
    .sort((a, b) => a - b);
  let wf2575 = 0;
  let wf1090 = 0;
  for (const p of post) {
    const f = predictFitted(p, wfCurve, model).fitted;
    const cap = p.mcap_usd!;
    if (cap >= f * Math.exp(k * quantile(trainRes, 0.25)) && cap <= f * Math.exp(k * quantile(trainRes, 0.75))) wf2575++;
    if (cap >= f * Math.exp(k * quantile(trainRes, 0.1)) && cap <= f * Math.exp(k * quantile(trainRes, 0.9))) wf1090++;
  }
  return {
    n: live.length,
    p25_75: round4(in2575 / live.length),
    p10_90: round4(in1090 / live.length),
    wf_n: post.length,
    wf_p25_75: post.length === 0 ? 0 : round4(wf2575 / post.length),
    wf_p10_90: post.length === 0 ? 0 : round4(wf1090 / post.length),
  };
}

// ---------------------------------------------------------------- board

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

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

/** The category's main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('launchpad')) return `Join $${capital} of the next ${name} launch on ${chain} and hold the allocation.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second qualifying action, different from the first, by category. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $25 against the supply on ${name}, then repay it in full the same week.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap $25 through ${name}'s main pool on ${chain} once a week.`;
  if (c.includes('bridge')) return `Bridge $25 back through ${name} once, so the wallet shows use in both directions.`;
  if (c.includes('staking') || c.includes('restak')) return `Restake or compound the staking rewards through ${name} once a month.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Close the hedge on ${name} and open a fresh one, so the wallet shows repeated use.`;
  if (c.includes('prediction')) return `Settle one more small market position on ${name} each week.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) return `Add $25 to the ${name} vault on ${chain} in a second deposit.`;
  if (c.includes('stable')) return `Swap $25 of the stable asset through ${name} once a week.`;
  if (c.includes('rwa')) return `Claim the yield on the ${name} asset once a month and leave the principal in place.`;
  if (c.includes('insurance')) return `Renew or top up the ${name} cover once, so the policy stays active.`;
  return `Make one more deposit of $25 into ${name} on ${chain} in a second week.`;
}

/** The weekly qualifying action, by category: the same action type as the
 * main position, repeated once a week so the wallet shows steady use. */
function weeklyActionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Each week, supply or borrow a small amount on ${name}, so the wallet shows steady lending use.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Each week, swap $25 through ${name}'s main pool on ${chain}.`;
  if (c.includes('bridge')) return `Each week, bridge a small amount through ${name} in one direction or the other.`;
  if (c.includes('staking') || c.includes('restak')) return `Each week, check the staking rewards on ${name} and compound them when they cover the gas.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Each week, open and close one small hedged position on ${name}.`;
  if (c.includes('prediction')) return `Each week, settle one more small market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) return `Each week, add $25 to the ${name} vault on ${chain} or rebalance between its vaults.`;
  if (c.includes('stable')) return `Each week, swap or deposit $25 of the stable asset through ${name}.`;
  if (c.includes('rwa')) return `Each week, check the yield on the ${name} asset and claim it when it covers the gas.`;
  if (c.includes('insurance')) return `Each week, check that the ${name} cover is still active and top it up when it runs low.`;
  return `Each week, make one more deposit of $25 into ${name} on ${chain}.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a
 * time, under one scenario. The plan is derived from the protocol's own
 * record (category, chains, TVL, age) and the scenario's deposit, gas and
 * horizon, never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, scenario: FarmScenario, model: ModelConstants = MODEL): FarmStep[] {
  const chain = chainOf(p);
  const capital = Math.round(Math.min(model.deposit_max, Math.max(model.deposit_min, scenario.deposit_pct * p.tvl_usd)));
  const perTx = gasPerTx(p, model);
  const holdDays = scenario.horizon_weeks * 7;
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, capital, chain);
  const weekly = weeklyActionFor(p, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `under $${Math.max(1, perTx)} of gas for the first transaction`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${perTx} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `about $${perTx} of gas`,
      time: '10 minutes',
    },
    {
      text: weekly,
      cost: `about $${perTx} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${holdDays} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${holdDays} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, then unwind the position in two parts so you keep the record.`,
      cost: `about $${perTx * 2} of gas to unwind`,
      time: '5 minutes to log, 10 minutes to unwind',
    },
  ];
}

/** How the snapshot's protocols split into exactly one group each: the
 * ranked board, the protocols that already record a token, and the
 * pre-token protocols set aside by category or by name. */
export function accounting(snapshot: Snapshot): Accounting {
  const watchlist = new Set(snapshot.watchlist);
  let ranked = 0;
  let watchlistN = 0;
  let belowFloor = 0;
  let offList = 0;
  let alreadyToken = 0;
  const setAsideGroups = new Map<string, number>();
  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) {
      alreadyToken++;
      continue;
    }
    if (isRankable(p) && p.tvl_usd >= 5_000_000) {
      ranked++;
      if (watchlist.has(p.slug)) watchlistN++;
      else if (p.tvl_usd >= snapshot.floor_usd) offList++;
      else belowFloor++;
      continue;
    }
    const group = p.tvl_usd < 5_000_000 ? 'below $5M TVL' : WRAPPED_CATEGORIES.has(p.category ?? '') ? p.category! : 'name rule';
    setAsideGroups.set(group, (setAsideGroups.get(group) ?? 0) + 1);
  }
  const order = ['Bridge', 'Canonical Bridge', 'CEX', 'Liquid Staking', 'Restaked BTC', 'Liquid Restaking', 'name rule'];
  const groups = order
    .filter((g) => setAsideGroups.has(g))
    .map((g) => ({ group: g, count: setAsideGroups.get(g)! }));
  for (const [g, c] of setAsideGroups) if (!order.includes(g)) groups.push({ group: g, count: c });
  return {
    total: snapshot.protocols.length,
    ranked,
    watchlist: watchlistN,
    below_floor: belowFloor,
    off_list: offList,
    already_token: alreadyToken,
    set_aside: [...setAsideGroups.values()].reduce((s, v) => s + v, 0),
    set_aside_groups: groups,
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. Ranked
 * by expected launch value: fitted value x token odds. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const live = liveProtocols(snapshot);
  const curve = fitSizeCurve(live, model);
  const oddsFit = fitOdds(snapshot, model);
  const scenario = defaultScenario(model);
  const watchlist = new Set(snapshot.watchlist);
  const scored: ScoredRow[] = snapshot.protocols
    .filter((p) => isRankable(p) && p.tvl_usd >= 5_000_000)
    .map((p) => {
      const f = predictFitted(p, curve, model);
      const o = oddsFor(p, snapshot.as_of, oddsFit);
      const expected = Math.max(1, Math.round(f.fitted * o.odds));
      return {
        p,
        fitted: f.fitted,
        multiple: f.multiple,
        baseMultiple: f.baseMultiple,
        catResidual: f.catResidual,
        catPeers: f.catPeers,
        odds: o.odds,
        logit: o.logit,
        terms: o.terms,
        expected,
        offList: !watchlist.has(p.slug) && p.tvl_usd >= snapshot.floor_usd,
        watchlist: watchlist.has(p.slug),
      };
    });
  const boot = bootstrap(scored, live, model);
  const ranges = predictionRanges(scored, live, model);
  const order = [...scored.keys()].sort((a, b) => {
    const A = scored[a]!;
    const B = scored[b]!;
    if (B.expected !== A.expected) return B.expected - A.expected;
    if (B.fitted !== A.fitted) return B.fitted - A.fitted;
    if (B.p.tvl_usd !== A.p.tvl_usd) return B.p.tvl_usd - A.p.tvl_usd;
    return A.p.slug < B.p.slug ? -1 : 1;
  });
  const board = order.map((idx, i) => {
    const s = scored[idx]!;
    const p = s.p;
    const e = farmEconomics(p, s.fitted, s.odds, s.expected, scenario, model);
    const v = verdictFor(e, model);
    const age = ageDays(snapshot.as_of, p.listed_at);
    return {
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'pre-token',
      age_days: age,
      off_list: s.offList,
      watchlist: s.watchlist,
      implied_value_usd: s.expected,
      model: {
        fitted_value_usd: s.fitted,
        fitted_multiple: s.multiple,
        base_multiple: s.baseMultiple,
        category_residual: s.catResidual,
        category_peers: s.catPeers,
        odds: s.odds,
        odds_logit: s.logit,
        odds_terms: s.terms,
        age_days: age,
      },
      verdict: v.verdict,
      verdict_reason: v.reason,
      deposit_usd: e.deposit,
      per_tx_usd: e.per_tx,
      fees_usd: e.fees,
      txs: e.txs,
      hours: e.hours,
      tbill_usd: e.tbill,
      net_usd: e.net,
      net_per_hour_usd: e.net_per_hour,
      break_even_drop_share: e.break_even_drop_share,
      break_even_odds: e.break_even_odds,
      p25_usd: ranges.p25[idx]!,
      p75_usd: ranges.p75[idx]!,
      p10_usd: ranges.p10[idx]!,
      p90_usd: ranges.p90[idx]!,
      rank_lo: boot.rankLo[idx]!,
      rank_hi: boot.rankHi[idx]!,
      farm_steps: farmSteps(p, scenario, model).map(stepText),
    };
  });
  return board;
}

/** The pre-token protocols the board does not rank, by TVL, with the
 * reason each one is set aside — the same groups the accounting counts. */
export function setAsideRows(snapshot: Snapshot): SetAsideRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && !(isRankable(p) && p.tvl_usd >= 5_000_000))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      reason: p.tvl_usd < 5_000_000 ? 'below $5M TVL' : WRAPPED_CATEGORIES.has(p.category ?? '') ? p.category! : 'name rule',
    }));
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

/** The value comps with their leave-one-out fitted values, for the detail
 * view's nearest priced peers table. */
export function compRows(snapshot: Snapshot, model: ModelConstants = MODEL): CompRow[] {
  const live = liveProtocols(snapshot);
  return live.map((p) => {
    const train = live.filter((q) => q.slug !== p.slug);
    const curve = fitSizeCurve(train, model);
    return {
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      change_7d: p.change_7d,
      loo_fitted_usd: predictFitted(p, curve, model).fitted,
    };
  });
}

/** A board row's compact form for data.js. */
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
    off_list: row.off_list,
    watchlist: row.watchlist,
    implied_value_usd: row.implied_value_usd,
    fitted_value_usd: row.model.fitted_value_usd,
    fitted_multiple: row.model.fitted_multiple,
    base_multiple: row.model.base_multiple,
    category_residual: row.model.category_residual,
    category_peers: row.model.category_peers,
    odds: row.model.odds,
    odds_logit: row.model.odds_logit,
    odds_terms: row.model.odds_terms,
    verdict: row.verdict,
    verdict_reason: row.verdict_reason,
    deposit_usd: row.deposit_usd,
    per_tx_usd: row.per_tx_usd,
    fees_usd: row.fees_usd,
    txs: row.txs,
    hours: row.hours,
    tbill_usd: row.tbill_usd,
    net_usd: row.net_usd,
    net_per_hour_usd: row.net_per_hour_usd,
    break_even_drop_share: row.break_even_drop_share,
    break_even_odds: row.break_even_odds,
    p25_usd: row.p25_usd,
    p75_usd: row.p75_usd,
    p10_usd: row.p10_usd,
    p90_usd: row.p90_usd,
    rank_lo: row.rank_lo,
    rank_hi: row.rank_hi,
  };
}

/** The market-cap-against-TVL scatter, precomputed at build time so the
 * dashboard text stays small: the live comps as dots, the fitted size
 * curve as a line, the board's rows as fitted dots. Pure SVG, no script,
 * so it renders the same in the page and in the dossier's screenshots. */
export function scatterSvg(comps: CompRow[], curve: SizeFit, rows: RadarRow[]): string {
  const W = 720;
  const H = 400;
  const PL = 66;
  const PR = 18;
  const PT = 16;
  const PB = 38;
  const xs = [...comps.map((c) => Math.log(c.tvl_usd)), ...rows.map((r) => Math.log(Math.max(1, r.tvl_usd)))];
  const ys = [...comps.map((c) => Math.log(c.mcap_usd)), ...rows.map((r) => Math.log(Math.max(1, r.fitted_value_usd)))];
  const x0 = Math.floor(Math.min(...xs) - 0.4);
  const x1 = Math.ceil(Math.max(...xs) + 0.4);
  const y0 = Math.floor(Math.min(...ys) - 0.4);
  const y1 = Math.ceil(Math.max(...ys) + 0.4);
  const X = (v: number): number => PL + ((v - x0) / (x1 - x0)) * (W - PL - PR);
  const Y = (v: number): number => PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB);
  const money = (e: number): string => (e >= 9 ? '$' + Math.round(10 ** (e - 9)) + 'B' : e >= 6 ? '$' + Math.round(10 ** (e - 6)) + 'M' : '$' + Math.round(10 ** e));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Market cap against TVL: live tokens, the fitted curve, and the board" style="width:100%;height:auto;display:block">`;
  for (let e = Math.ceil(x0 / Math.LN10); e * Math.LN10 <= x1; e++) {
    const x = X(e * Math.LN10);
    s += `<line x1="${x.toFixed(1)}" y1="${PT}" x2="${x.toFixed(1)}" y2="${H - PB}" stroke="#2a3040" stroke-width="1"/><text x="${x.toFixed(1)}" y="${H - 14}" fill="#8a93a6" font-size="11" text-anchor="middle">${money(e)}</text>`;
  }
  for (let e = Math.ceil(y0 / Math.LN10); e * Math.LN10 <= y1; e++) {
    const y = Y(e * Math.LN10);
    s += `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W - PR}" y2="${y.toFixed(1)}" stroke="#2a3040" stroke-width="1"/><text x="${PL - 8}" y="${(y + 4).toFixed(1)}" fill="#8a93a6" font-size="11" text-anchor="end">${money(e)}</text>`;
  }
  s += `<text x="${((W - PL - PR) / 2 + PL).toFixed(1)}" y="${H - 2}" fill="#8a93a6" font-size="11" text-anchor="middle">TVL (log)</text>`;
  s += `<text x="14" y="${((H - PT - PB) / 2 + PT).toFixed(1)}" fill="#8a93a6" font-size="11" text-anchor="middle" transform="rotate(-90 14 ${((H - PT - PB) / 2 + PT).toFixed(1)})">Market cap (log)</text>`;
  let line = '';
  for (let i = 0; i <= 40; i++) {
    const x = x0 + ((x1 - x0) * i) / 40;
    line += `${X(x).toFixed(1)},${Y(curve.intercept + curve.slope * x).toFixed(1)} `;
  }
  s += `<polyline points="${line.trim()}" fill="none" stroke="#f0b429" stroke-width="2"/>`;
  for (const c of comps) s += `<circle cx="${X(Math.log(c.tvl_usd)).toFixed(1)}" cy="${Y(Math.log(c.mcap_usd)).toFixed(1)}" r="2.6" fill="#9aa3b2"><title>${c.name}: TVL ${c.tvl_usd}, cap ${c.mcap_usd}</title></circle>`;
  for (const r of rows) s += `<circle cx="${X(Math.log(Math.max(1, r.tvl_usd))).toFixed(1)}" cy="${Y(Math.log(Math.max(1, r.fitted_value_usd))).toFixed(1)}" r="3" fill="#34d399"><title>${r.name}: fitted ${r.fitted_value_usd}</title></circle>`;
  s += `<g font-size="11" fill="#c7cdd9"><circle cx="${PL + 8}" cy="${PT + 8}" r="3" fill="#9aa3b2"/><text x="${PL + 16}" y="${PT + 12}">live token, real cap</text><circle cx="${PL + 150}" cy="${PT + 8}" r="3" fill="#34d399"/><text x="${PL + 158}" y="${PT + 12}">board row, fitted value</text><line x1="${PL + 300}" y1="${PT + 8}" x2="${PL + 330}" y2="${PT + 8}" stroke="#f0b429" stroke-width="2"/><text x="${PL + 336}" y="${PT + 12}">size curve</text></g>`;
  return `${s}</svg>`;
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const honesty = rangeHonesty(snapshot, model);
  const live = liveRows(snapshot);
  const curve = fitSizeCurve(liveProtocols(snapshot), model);
  const oddsFit = fitOdds(snapshot, model);
  const brier = oddsBrier(snapshot, oddsFit);
  const cal = oddsCalibration(snapshot, model);
  const validation = validateModel(snapshot, model);
  const evidence = valueEvidence(snapshot, model);
  const oddsEv = oddsEvidence(snapshot, model);
  const stability = coeffStability(snapshot, model);
  const acct = accounting(snapshot);
  const covered = snapshot.watchlist.filter((s) => board.some((r) => r.slug === s)).length;
  const verdict_counts = { FARM: 0, MARGINAL: 0, SKIP: 0 };
  for (const r of board) verdict_counts[r.verdict]++;
  const rows = board.map(radarRow);
  const comps = compRows(snapshot, model);
  const setAside = setAsideRows(snapshot);
  const sizeFit = { intercept: round4(curve.intercept), slope: round4(curve.slope), live_protocols: liveProtocols(snapshot).length };
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    watchlist_covered: covered,
    board_size: board.length,
    early_size: board.filter((r) => !r.watchlist).length,
    off_list_size: board.filter((r) => r.off_list).length,
    live_size: live.length,
    size_fit: sizeFit,
    odds_model: {
      global_rate: oddsFit.global,
      peers: oddsPeers(snapshot).length,
      no_age_count: snapshot.protocols.filter((p) => isRankable(p) && p.listed_at === null).length,
      intercept: oddsFit.intercept,
      coefs: oddsFit.coefs,
      means: oddsFit.means,
      stds: oddsFit.stds,
      brier_base: brier.base,
      brier_buckets_loo: brier.buckets_loo,
      brier_logistic_cv: brier.logistic_cv,
      brier_logistic_cat_cv: brier.logistic_cat_cv,
      brier_logistic_wf: oddsEv.wf_logistic,
      brier_logistic_cat_wf: oddsEv.wf_logistic_cat,
      brier_control_wf: oddsEv.wf_control,
    },
    odds_table: cal.buckets,
    validation,
    evidence,
    odds_evidence: oddsEv,
    coeff_stability: stability,
    scatter_svg: scatterSvg(comps, sizeFit, rows),
    accounting: acct,
    honesty,
    checksum: '',
    verdict_counts,
    total_fitted_usd: board.reduce((s, r) => s + r.model.fitted_value_usd, 0),
    total_expected_usd: board.reduce((s, r) => s + r.implied_value_usd, 0),
    rows,
    live,
    comps,
    set_aside: setAside,
    watchlist: snapshot.watchlist,
  };
  radar.checksum = fnv1aHex(JSON.stringify(rows));
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
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
