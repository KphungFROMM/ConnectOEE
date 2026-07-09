/** Mirrors ASP.NET Identity options in ConnectOEE.Infrastructure DependencyInjection. */
export interface PasswordRule {
  id: string
  label: string
  test: (password: string) => boolean
}

export const passwordRules: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'digit', label: 'One number (0–9)', test: (p) => /\d/.test(p) },
]

export function passwordMeetsPolicy(password: string): boolean {
  return passwordRules.every((rule) => rule.test(password))
}

export function countMetRules(password: string): number {
  return passwordRules.filter((rule) => rule.test(password)).length
}

export function passwordStrengthLabel(met: number): { label: string; color: string } {
  if (met === 0) return { label: 'Enter a password', color: 'gray' }
  if (met <= 1) return { label: 'Weak', color: 'red' }
  if (met <= 3) return { label: 'Fair', color: 'yellow' }
  return { label: 'Strong', color: 'green' }
}

export function usernameMeetsPolicy(userName: string): boolean {
  const trimmed = userName.trim()
  return trimmed.length >= 2 && /^[\w.\-@+]+$/.test(trimmed)
}

export const usernameHint = '2+ characters; letters, numbers, and . _ - @ + only'
