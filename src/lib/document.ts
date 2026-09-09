/**
 * Validador e formatador de CPF e CNPJ
 * Garante que cada conta criada no Trackbase possua um documento fiscal válido
 * evitando abusos de múltiplas contas e garantindo conformidade.
 */

export function cleanDocument(val: string): string {
  return (val || "").replace(/\D/g, "");
}

export function isValidCpf(cpf: string): boolean {
  const clean = cleanDocument(cpf);
  if (clean.length !== 11) return false;

  // Rejeita números com todos os dígitos iguais (ex: 111.111.111-11, 000.000.000-00)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean.charAt(9), 10)) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

export function isValidCnpj(cnpj: string): boolean {
  const clean = cleanDocument(cnpj);
  if (clean.length !== 14) return false;

  // Rejeita sequências repetidas
  if (/^(\d)\1{13}$/.test(clean)) return false;

  // Primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean.charAt(i), 10) * weights1[i];
  }
  let rest = sum % 11;
  const digit1 = rest < 2 ? 0 : 11 - rest;
  if (digit1 !== parseInt(clean.charAt(12), 10)) return false;

  // Segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(clean.charAt(i), 10) * weights2[i];
  }
  rest = sum % 11;
  const digit2 = rest < 2 ? 0 : 11 - rest;
  if (digit2 !== parseInt(clean.charAt(13), 10)) return false;

  return true;
}

export function formatDocument(val: string): string {
  const clean = cleanDocument(val);
  if (clean.length <= 11) {
    // Formata CPF: 000.000.000-00
    return clean
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2")
      .slice(0, 14);
  }
  // Formata CNPJ: 00.000.000/0000-00
  return clean
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
}

export type DocumentValidationResult = {
  valid: boolean;
  type: "CPF" | "CNPJ" | null;
  clean: string;
  formatted: string;
  error?: string;
};

export function validateDocument(raw: string): DocumentValidationResult {
  const clean = cleanDocument(raw);

  if (!clean) {
    return {
      valid: false,
      type: null,
      clean: "",
      formatted: "",
      error: "Informe o CPF ou CNPJ.",
    };
  }

  if (clean.length === 11) {
    if (!isValidCpf(clean)) {
      return {
        valid: false,
        type: "CPF",
        clean,
        formatted: formatDocument(clean),
        error: "CPF inválido. Verifique os números digitados.",
      };
    }
    return {
      valid: true,
      type: "CPF",
      clean,
      formatted: formatDocument(clean),
    };
  }

  if (clean.length === 14) {
    if (!isValidCnpj(clean)) {
      return {
        valid: false,
        type: "CNPJ",
        clean,
        formatted: formatDocument(clean),
        error: "CNPJ inválido. Verifique os números digitados.",
      };
    }
    return {
      valid: true,
      type: "CNPJ",
      clean,
      formatted: formatDocument(clean),
    };
  }

  return {
    valid: false,
    type: null,
    clean,
    formatted: clean,
    error: "Documento incompleto. Digite um CPF (11 dígitos) ou CNPJ (14 dígitos).",
  };
}
