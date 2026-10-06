export const REQUEST_CATEGORIES = ['FOOD', 'GROCERIES', 'MEDICINE', 'STATIONERY', 'TOOLS', 'OTHER'];

export function parseQuantity(value) {
  const match = value.trim().match(/^([1-9]\d*)\s*(.*)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount < 1) return null;
  return { amount, label: value.trim(), unit: match[2].trim() };
}

export function validateCreateRequest(form, now = new Date()) {
  const errors = {};
  if (!form.item.trim()) errors.item = 'Item is required.';
  if (!REQUEST_CATEGORIES.includes(form.category)) errors.category = 'Please select a category.';
  if (!form.quantity.trim()) errors.quantity = 'Quantity is required.';
  else if (!parseQuantity(form.quantity)) errors.quantity = 'Enter a positive whole-number quantity, such as “2 packets”.';

  if (form.reward.trim() === '') errors.reward = 'Reward must be a valid amount.';
  else {
    const reward = Number(form.reward);
    if (!Number.isFinite(reward)) errors.reward = 'Reward must be a valid amount.';
    else if (reward < 0) errors.reward = 'Reward cannot be negative.';
    else if (!/^\d+(?:\.\d{1,2})?$/.test(form.reward.trim()) || reward > 100_000) {
      errors.reward = 'Reward must be a valid amount (up to ₹100,000, with at most 2 decimals).';
    }
  }

  if (!form.location.trim()) errors.location = 'Location is required.';
  if (!form.requiredTime) errors.requiredTime = 'Please select when you need this request.';
  else {
    const requiredTime = new Date(form.requiredTime);
    if (Number.isNaN(requiredTime.getTime())) errors.requiredTime = 'Please choose a valid date and time.';
    else if (requiredTime.getTime() <= now.getTime()) errors.requiredTime = 'Required time must be in the future.';
  }
  if (form.instructions.length > 500) errors.instructions = 'Instructions must be 500 characters or fewer.';
  return errors;
}

export function localDateTimeValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}
