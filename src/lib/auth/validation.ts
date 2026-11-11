// Regras dos formulários de login e registo (mock). Quando houver backend, a validação
// "a sério" passa para lá; estas regras ficam só como validação rápida no cliente.

export const MIN_PASSWORD_LENGTH = 8;

// nome@dominio.tld: sem espaços, sem "@" repetido, domínio com pelo menos um ponto e TLD com 2+ caracteres
const EMAIL_PATTERN = /^[^\s@]+@([^\s@.]+\.)+[^\s@.]{2,}$/;

// 3 a 20 caracteres; letras, números, ponto, hífen e underscore; começa com letra ou número
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,19}$/;

const EMAIL_MESSAGE = "Enter a valid email address, e.g. name@company.com.";
const PASSWORD_MESSAGE = `Password must have at least ${MIN_PASSWORD_LENGTH} characters.`;

export type CredentialErrors = { email?: string; password?: string };

export function validateCredentials(email: string, password: string): CredentialErrors {
  const errors: CredentialErrors = {};
  if (!EMAIL_PATTERN.test(email.trim())) errors.email = EMAIL_MESSAGE;
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = PASSWORD_MESSAGE;
  return errors;
}

export type SignUpValues = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
};

export type SignUpField = keyof SignUpValues;
export type SignUpErrors = Partial<Record<SignUpField, string>>;

export function validateSignUp(values: SignUpValues): SignUpErrors {
  const errors: SignUpErrors = {};
  if (!USERNAME_PATTERN.test(values.username.trim())) {
    errors.username = "Use 3–20 characters: letters, numbers, dots, hyphens or underscores.";
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = EMAIL_MESSAGE;
  if (values.password.length < MIN_PASSWORD_LENGTH) errors.password = PASSWORD_MESSAGE;
  if (!values.confirmPassword) errors.confirmPassword = "Confirm your password.";
  else if (values.confirmPassword !== values.password) errors.confirmPassword = "Passwords do not match.";
  if (!values.acceptTerms) errors.acceptTerms = "You must accept the Terms of Service to create an account.";
  if (!values.acceptPrivacy) errors.acceptPrivacy = "You must accept the Privacy Policy to create an account.";
  return errors;
}
