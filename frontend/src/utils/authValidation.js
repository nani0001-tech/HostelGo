const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s().-]+$/;

export function validateRegistration(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Enter your name.';
  if (!form.email.trim()) errors.email = 'Enter your email address.';
  else if (!emailPattern.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (!form.password) errors.password = 'Create a password.';
  else if (form.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (!form.confirmPassword) errors.confirmPassword = 'Confirm your password.';
  else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  if (form.phone.trim()) {
    const digits = form.phone.replace(/\D/g, '').length;
    if (!phonePattern.test(form.phone.trim()) || digits < 7 || digits > 15) errors.phone = 'Enter a valid phone number.';
  }
  if (!form.hostel.trim()) errors.hostel = 'Enter your hostel.';
  return errors;
}
