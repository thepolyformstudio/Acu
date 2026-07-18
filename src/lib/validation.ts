const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const API_KEY_PREFIX = "AIzaSy";
const COUPON_REGEX = /^[A-Za-z0-9_-]{3,30}$/;
const SAFE_TEXT_REGEX = /^[a-zA-Z0-9\s.,!?'"()\-:;/@#$%&*+=_{}\[\]<>]+$/;

const LIMITS = {
  emailMaxLength: 254,
  passwordMinLength: 6,
  passwordMaxLength: 128,
  apiKeyMinLength: 20,
  apiKeyMaxLength: 200,
  chapterTitleMaxLength: 200,
  customSubjectMaxLength: 100,
  feedbackMaxLength: 2000,
  maxFileSizeMB: 50,
  allowedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ] as readonly string[],
} as const;

export function validateEmail(email: string): string | null {
  if (!email || email.trim().length === 0) return "Email is required.";
  if (email.length > LIMITS.emailMaxLength) return "Email is too long.";
  if (!EMAIL_REGEX.test(email.trim())) return "Please enter a valid email address.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < LIMITS.passwordMinLength) return `Password must be at least ${LIMITS.passwordMinLength} characters.`;
  if (password.length > LIMITS.passwordMaxLength) return `Password must be at most ${LIMITS.passwordMaxLength} characters.`;
  return null;
}

export function validateApiKey(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) return "API key is required.";
  if (trimmed.length < LIMITS.apiKeyMinLength) return "API key seems too short.";
  if (trimmed.length > LIMITS.apiKeyMaxLength) return "API key is too long.";
  if (!trimmed.startsWith(API_KEY_PREFIX)) return "API key should start with 'AIzaSy'.";
  if (!SAFE_TEXT_REGEX.test(trimmed)) return "API key contains invalid characters.";
  return null;
}

export function validateCoupon(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return "Coupon code is required.";
  if (!COUPON_REGEX.test(trimmed)) return "Coupon code must be 3-30 alphanumeric characters.";
  return null;
}

export function validateChapterTitle(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length > LIMITS.chapterTitleMaxLength) return `Title must be at most ${LIMITS.chapterTitleMaxLength} characters.`;
  return null;
}

export function validateCustomSubject(subject: string): string | null {
  const trimmed = subject.trim();
  if (trimmed.length > LIMITS.customSubjectMaxLength) return `Subject must be at most ${LIMITS.customSubjectMaxLength} characters.`;
  return null;
}

export function validateFeedback(text: string): string | null {
  if (text.length > LIMITS.feedbackMaxLength) return `Feedback must be at most ${LIMITS.feedbackMaxLength} characters.`;
  if (text.length > 0 && !SAFE_TEXT_REGEX.test(text)) return "Please use only standard text and numbers. No special symbols or code allowed.";
  return null;
}

export function validateFile(file: File): string | null {
  if (file.size === 0) return "File is empty.";
  if (file.size > LIMITS.maxFileSizeMB * 1024 * 1024) return `File must be under ${LIMITS.maxFileSizeMB}MB.`;
  if (!LIMITS.allowedMimeTypes.includes(file.type)) {
    if (file.name.endsWith(".pdf") && file.type === "") return null;
    if (file.name.endsWith(".docx") && file.type === "") return null;
    if (file.name.endsWith(".txt") && file.type === "") return null;
    return `File type '${file.type || "unknown"}' is not supported. Allowed: PDF, DOCX, TXT.`;
  }
  return null;
}

export { LIMITS };
