/**
 * Formats a UTC offset in minutes to a string like "-05:00" or "+02:00".
 * @param {number} offsetMinutes - The UTC offset in minutes (positive = behind UTC, negative = ahead of UTC)
 * @returns {string}
 */
const formatUtcOffset = (offsetMinutes) => {
  const sign = offsetMinutes < 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Calculates the UTC offset for a specific moment in time
 * (represented by its Unix timestamp) in the local time zone.
 * @param {number} timestampMs - The Unix timestamp in milliseconds.
 * @returns {{rawMinutes: number, formatted: string, fullDateTime: string}} The offset details.
 */
const getLocalOffsetDetailsFromTimestamp = (timestampMs) => {
  // 1. Create the Date object using the timestamp.
  //    JS always treats this number as the time since Epoch (UTC).
  const dateObj = new Date(timestampMs);

  // 2. getTimezoneOffset() then looks at this specific moment in time
  //    and determines what the local offset (including DST) was at that instant.
  const offsetMinutes = dateObj.getTimezoneOffset();

  return {
    rawMinutes: offsetMinutes,
    formatted: formatUtcOffset(offsetMinutes),
    fullDateTime: dateObj.toString()
  };
};

module.exports = { formatUtcOffset, getLocalOffsetDetailsFromTimestamp };