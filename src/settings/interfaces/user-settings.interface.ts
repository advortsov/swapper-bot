const DEFAULT_SLIPPAGE = 0.5;
const DEFAULT_PREFERRED_AGGREGATOR = 'auto';
const MIN_SLIPPAGE = 0.01;
const MAX_SLIPPAGE = 50;

export interface IUserSettings {
  slippage: number;
  preferredAggregator: string;
}

export const DEFAULT_USER_SETTINGS: Readonly<IUserSettings> = {
  slippage: DEFAULT_SLIPPAGE,
  preferredAggregator: DEFAULT_PREFERRED_AGGREGATOR,
};

export const KNOWN_AGGREGATORS = ['auto', 'paraswap', 'zerox', 'odos', 'jupiter'] as const;

export function isKnownAggregator(value: string): boolean {
  return (KNOWN_AGGREGATORS as readonly string[]).includes(value);
}

export function isValidSlippage(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_SLIPPAGE && value <= MAX_SLIPPAGE;
}

export function parseUserSettings(raw: unknown): IUserSettings {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_USER_SETTINGS };
  }

  const record = raw as Record<string, unknown>;

  const slippage =
    typeof record['slippage'] === 'number' && isValidSlippage(record['slippage'])
      ? record['slippage']
      : DEFAULT_USER_SETTINGS.slippage;

  const preferredAggregator =
    typeof record['preferredAggregator'] === 'string' &&
    isKnownAggregator(record['preferredAggregator'])
      ? record['preferredAggregator']
      : DEFAULT_USER_SETTINGS.preferredAggregator;

  return { slippage, preferredAggregator };
}
