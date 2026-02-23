function toDate(maybeTimestamp) {
  if (!maybeTimestamp) return null;
  if (maybeTimestamp.toDate && typeof maybeTimestamp.toDate === "function") {
    return maybeTimestamp.toDate();
  }
  if (maybeTimestamp instanceof Date) return maybeTimestamp;
  const d = new Date(maybeTimestamp);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function diffDays(a, b) {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

module.exports = { toDate, diffDays };

