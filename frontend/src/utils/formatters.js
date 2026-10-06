export function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

export function formatDateTime(value) {
  if (!value) return 'Flexible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Flexible';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
