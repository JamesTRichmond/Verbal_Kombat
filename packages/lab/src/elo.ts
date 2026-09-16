/**
 * Elo — the Agent Arena's ladder math.
 *
 *   E_A = 1 / (1 + 10^((R_B − R_A) / 400))
 *   R'_A = R_A + K · (S_A − E_A)        S = 1 win, 0.5 draw, 0 loss
 */

export const DEFAULT_RATING = 1000;
export const DEFAULT_K = 24;

/** Expected score of a player rated `ra` against one rated `rb` (0..1). */
export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/** New ratings after one game. `scoreA` is 1 (A won), 0.5 (draw) or 0 (B won). */
export function updateElo(ra: number, rb: number, scoreA: number, k = DEFAULT_K): { a: number; b: number } {
  const ea = expectedScore(ra, rb);
  const delta = k * (scoreA - ea);
  return { a: ra + delta, b: rb - delta };
}

export interface LadderRow {
  id: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  games: number;
}

export class Ladder {
  private readonly rows = new Map<string, LadderRow>();

  constructor(
    private readonly opts: { k?: number; initial?: number } = {},
  ) {}

  add(id: string): LadderRow {
    let row = this.rows.get(id);
    if (!row) {
      row = { id, rating: this.opts.initial ?? DEFAULT_RATING, wins: 0, losses: 0, draws: 0, games: 0 };
      this.rows.set(id, row);
    }
    return row;
  }

  rating(id: string): number {
    return this.add(id).rating;
  }

  /** Record a result. `winner` is the winning id, or null for a draw. */
  record(a: string, b: string, winner: string | null): void {
    if (a === b) throw new Error('Ladder: a player cannot play itself');
    if (winner !== null && winner !== a && winner !== b) throw new Error(`Ladder: ${winner} did not play`);
    const ra = this.add(a);
    const rb = this.add(b);
    const score = winner === null ? 0.5 : winner === a ? 1 : 0;
    const next = updateElo(ra.rating, rb.rating, score, this.opts.k ?? DEFAULT_K);
    ra.rating = next.a;
    rb.rating = next.b;
    ra.games++;
    rb.games++;
    if (winner === null) {
      ra.draws++;
      rb.draws++;
    } else if (winner === a) {
      ra.wins++;
      rb.losses++;
    } else {
      rb.wins++;
      ra.losses++;
    }
  }

  /** Highest rating first; ties broken by id for deterministic output. */
  standings(): LadderRow[] {
    return [...this.rows.values()]
      .map((r) => ({ ...r }))
      .sort((x, y) => y.rating - x.rating || x.id.localeCompare(y.id));
  }
}
