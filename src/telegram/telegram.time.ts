const DEFAULT_TIME_ZONE = 'Europe/Volgograd';
const DATE_TIME_LOCALE = 'ru-RU';
const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;

export function createDateTimeFormatter(appTimeZone?: string): Intl.DateTimeFormat {
  const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fallbackTimeZone =
    typeof systemTimeZone === 'string' && systemTimeZone.trim() !== ''
      ? systemTimeZone
      : DEFAULT_TIME_ZONE;
  const timeZone = resolveTimeZone(appTimeZone, fallbackTimeZone);

  return new Intl.DateTimeFormat(DATE_TIME_LOCALE, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatLocalDateTime(value: string, formatter: Intl.DateTimeFormat): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = formatter.formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const day = byType.get('day');
  const month = byType.get('month');
  const year = byType.get('year');
  const hour = byType.get('hour');
  const minute = byType.get('minute');

  if (!day || !month || !year || !hour || !minute) {
    return formatter.format(date);
  }

  return `${day}.${month}.${year} ${hour}:${minute}`;
}

export function formatSwapValidity(expiresAt: string, nowMs: number = Date.now()): string {
  const expiresAtMs = new Date(expiresAt).getTime();

  if (Number.isNaN(expiresAtMs)) {
    return 'неизвестно';
  }

  const remainingSeconds = Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
  const remainingMinutes = Math.floor(remainingSeconds / SECONDS_IN_MINUTE);
  const remainingHours = Math.floor(remainingMinutes / MINUTES_IN_HOUR);

  if (remainingHours > 0) {
    const minutes = remainingMinutes % MINUTES_IN_HOUR;
    return `${remainingHours} ч ${minutes} мин`;
  }

  if (remainingMinutes > 0) {
    return `${remainingMinutes} мин`;
  }

  return `${remainingSeconds} сек`;
}

function resolveTimeZone(value: string | undefined, fallback: string): string {
  if (!value || value.trim() === '') {
    return fallback;
  }

  try {
    new Intl.DateTimeFormat(DATE_TIME_LOCALE, { timeZone: value });
    return value;
  } catch {
    return fallback;
  }
}
