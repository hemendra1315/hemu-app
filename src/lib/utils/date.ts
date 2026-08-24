import dayjs from 'dayjs';
import timezonePlugin from 'dayjs/plugin/timezone';
import utcPlugin from 'dayjs/plugin/utc';

import { env } from '@/lib/env';

dayjs.extend(utcPlugin);
dayjs.extend(timezonePlugin);

/**
 * Timestamps are stored UTC and rendered in the academy's timezone
 * (default Asia/Kolkata). Always format through these helpers.
 */
export function inAcademyTz(value: string | Date, timezone = env.defaultTimezone) {
  return dayjs.utc(value).tz(timezone);
}

export function formatDate(value: string | Date, timezone = env.defaultTimezone): string {
  return inAcademyTz(value, timezone).format('DD MMM YYYY');
}

export function formatTime(value: string | Date, timezone = env.defaultTimezone): string {
  return inAcademyTz(value, timezone).format('h:mm A');
}

export function formatDateTime(value: string | Date, timezone = env.defaultTimezone): string {
  return inAcademyTz(value, timezone).format('DD MMM YYYY, h:mm A');
}

export function toIsoDate(value: string | Date, timezone = env.defaultTimezone): string {
  return inAcademyTz(value, timezone).format('YYYY-MM-DD');
}

/**
 * True when `value` falls on today's date or any future date, evaluated in the
 * academy timezone. Used by the dashboards to split "today/upcoming" sessions.
 */
export function isTodayOrUpcoming(value: string | Date, timezone = env.defaultTimezone): boolean {
  const today = dayjs().tz(timezone).format('YYYY-MM-DD');
  return inAcademyTz(value, timezone).format('YYYY-MM-DD') >= today;
}

/** True when `value` falls on today's date in the academy timezone. */
export function isToday(value: string | Date, timezone = env.defaultTimezone): boolean {
  const today = dayjs().tz(timezone).format('YYYY-MM-DD');
  return inAcademyTz(value, timezone).format('YYYY-MM-DD') === today;
}

export function isTimeRangeValid(startTime: Date | null, endTime: Date | null) {
  if (!startTime || !endTime) return true;
  const startMins = startTime.getHours() * 60 + startTime.getMinutes();
  const endMins = endTime.getHours() * 60 + endTime.getMinutes();
  return endMins > startMins;
}

export { dayjs };
