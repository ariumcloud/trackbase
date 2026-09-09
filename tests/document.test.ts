import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanDocument,
  isValidCpf,
  isValidCnpj,
  formatDocument,
  validateDocument,
} from "../src/lib/document";

test("Documentos: limpeza de caracteres e formatação", () => {
  assert.equal(cleanDocument("123.456.789-00"), "12345678900");
  assert.equal(cleanDocument("12.345.678/0001-90"), "12345678000190");
  assert.equal(cleanDocument("abc123def"), "123");

  assert.equal(formatDocument("52998224725"), "529.982.247-25");
  assert.equal(formatDocument("11222333000181"), "11.222.333/0001-81");
});

test("CPF: validação de dígitos verificadores e rejeição de inválidos", () => {
  // CPF válido gerado matematicamente
  assert.equal(isValidCpf("52998224725"), true);
  assert.equal(isValidCpf("529.982.247-25"), true);

  // CPF inválido (dígito errado)
  assert.equal(isValidCpf("52998224726"), false);

  // CPFs com todos dígitos iguais (rejeitados por regra da Receita Federal)
  assert.equal(isValidCpf("00000000000"), false);
  assert.equal(isValidCpf("11111111111"), false);
  assert.equal(isValidCpf("99999999999"), false);

  // Tamanho incorreto
  assert.equal(isValidCpf("1234567890"), false);
  assert.equal(isValidCpf("123456789012"), false);
});

test("CNPJ: validação de dígitos verificadores e rejeição de inválidos", () => {
  // CNPJs válidos conhecidos
  assert.equal(isValidCnpj("11222333000181"), true);
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);

  // CNPJ inválido (dígito verificador alterado)
  assert.equal(isValidCnpj("11222333000182"), false);

  // CNPJ sequencial repetido
  assert.equal(isValidCnpj("00000000000000"), false);
  assert.equal(isValidCnpj("11111111111111"), false);

  // Tamanho incorreto
  assert.equal(isValidCnpj("1122233300018"), false);
});

test("validateDocument: classificação e erros amigáveis", () => {
  const validCpf = validateDocument("529.982.247-25");
  assert.equal(validCpf.valid, true);
  assert.equal(validCpf.type, "CPF");
  assert.equal(validCpf.clean, "52998224725");

  const validCnpj = validateDocument("11.222.333/0001-81");
  assert.equal(validCnpj.valid, true);
  assert.equal(validCnpj.type, "CNPJ");
  assert.equal(validCnpj.clean, "11222333000181");

  const invalidDigits = validateDocument("12345678900");
  assert.equal(invalidDigits.valid, false);
  assert.match(invalidDigits.error || "", /CPF inválido/);

  const incomplete = validateDocument("12345");
  assert.equal(incomplete.valid, false);
  assert.match(incomplete.error || "", /Documento incompleto/);

  const empty = validateDocument("");
  assert.equal(empty.valid, false);
  assert.match(empty.error || "", /Informe o CPF ou CNPJ/);
});
