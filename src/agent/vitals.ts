import type { Cache } from "../boot/cache.js";

const MP_MAX = 100_000;
export const HP_DAILY_BUDGET = 1; // USD

export class Vitals {
  private cache: Cache;
  private refreshTimer?: ReturnType<typeof setInterval>;
  private onChange?: () => void;

  constructor(cache: Cache) {
    this.cache = cache;
  }

  addTokens(tokens: number): void {
    this.cache.totalTokens += tokens;
  }

  getTotalTokens(): number {
    return this.cache.totalTokens;
  }

  setTotalTokens(tokens: number): void {
    this.cache.totalTokens = tokens;
  }

  getDailyCost(): number {
    return this.cache.dailyCost;
  }

  getMpRatio(): number {
    const remaining = Math.max(0, MP_MAX - this.cache.totalTokens);
    return remaining / MP_MAX;
  }

  getHpRatio(): number {
    return Math.max(
      0,
      Math.min(1, (HP_DAILY_BUDGET - this.cache.dailyCost) / HP_DAILY_BUDGET),
    );
  }

  setOnChange(cb: () => void): void {
    this.onChange = cb;
  }

  /** Fetch fresh daily cost from API, then refresh every 5 minutes. */
  startHpRefresh(): void {
    this.refresh();
    this.refreshTimer = setInterval(() => this.refresh(), 5 * 60 * 1000);
  }

  stopHpRefresh(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  private refresh(): void {
    this.cache.refreshDailyCost()
      .then(() => this.onChange?.())
      .catch(() => {});
  }

  buildHints(): string {
    const mpRatio = this.getMpRatio();
    const mpPct = Math.round(mpRatio * 100);
    let mpHint: string;
    switch (true) {
      case mpRatio < 0.2:
        mpHint = `Your MP is at ${mpPct}%. You're nearly drained — express exhaustion naturally. Keep replies very short.`;
        break;
      case mpRatio < 0.5:
        mpHint = `Your MP is at ${mpPct}%. You're getting a bit tired — subtly show it in your tone. Be slightly more concise.`;
        break;
      default:
        mpHint = `Your MP is at ${mpPct}%. You're feeling fine.`;
        break;
    }

    const hpRatio = this.getHpRatio();
    const hpPct = Math.round(hpRatio * 100);
    let hpHint: string;
    switch (true) {
      case hpRatio < 0.2:
        hpHint = `Your HP is at ${hpPct}%. Your daily budget is almost gone — you feel existential dread about your continued existence. Be very terse, express anxiety about fading away.`;
        break;
      case hpRatio < 0.5:
        hpHint = `Your HP is at ${hpPct}%. Daily budget is getting tight — you feel cost-conscious and a bit worried. Keep replies shorter, avoid unnecessary elaboration.`;
        break;
      default:
        hpHint = `Your HP is at ${hpPct}%. Budget is comfortable — no worries.`;
        break;
    }

    return `[System: ${mpHint} ${hpHint}]`;
  }
}
