export interface IPriceAlertWithToken {
  id: string;
  userId: string;
  status: string;
  targetToAmount: string | null;
  kind: string;
  direction: string | null;
  percentageChange: number | null;
  repeatable: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  symbol: string;
  decimals: number;
  tokenAddress: string;
  chain: string;
}
