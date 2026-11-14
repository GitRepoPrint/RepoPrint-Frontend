// Regras dos formulários de login e registo. O servidor repete-as (o Keycloak tem a palavra-passe final).

export const MIN_PASSWORD_LENGTH= 12;

// nome@dominio.tld: sem espaços, sem "@" repetido, domínio com pelo menos um ponto e TLD com 2+ caracteres
export const EMAIL_PATTERN = /^[^\s@]+@([^\s@.]+\.)+[^\s@.]{2,}$/;

// 3 a 20 caracteres; letras, números, ponto, hífen e underscore; começa com letra ou número
export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,19}$/;

const EMAIL_MESSAGE = "Enter a valid email address, e.g. name@company.com.";
const PASSWORD_MESSAGE = `Password must have at least ${MIN_PASSWORD_LENGTH} characters.`;

export type CredentialErrors= { identifier?: string; password?: string };

export function validateLogin(identifier: string, password: string): CredentialErrors {
  const errors: CredentialErrors= {};
  if (!identifier.trim()) errors.identifier= "Enter your email or username.";
  if (!password) errors.password= "Enter your password.";
  return errors;
}

export type AccountValues= { username: string; email: string; password: string };
export type AccountErrors= Partial<Record<keyof AccountValues, string>>;

export function validateAccount(values: AccountValues): AccountErrors {
  const errors: AccountErrors= {};
  if (!USERNAME_PATTERN.test(values.username.trim())) {
    errors.username= "Use 3–20 characters: letters, numbers, dots, hyphens or underscores.";
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email= EMAIL_MESSAGE;
  if (values.password.length < MIN_PASSWORD_LENGTH) errors.password= PASSWORD_MESSAGE;
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
  const errors: SignUpErrors= validateAccount(values);
  if (!values.confirmPassword) errors.confirmPassword = "Confirm your password.";
  else if (values.confirmPassword !== values.password) errors.confirmPassword = "Passwords do not match.";
  if (!values.acceptTerms) errors.acceptTerms = "You must accept the Terms of Service to create an account.";
  if (!values.acceptPrivacy) errors.acceptPrivacy = "You must accept the Privacy Policy to create an account.";
  return errors;
}
