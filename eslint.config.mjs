import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      ".next-verify",
      ".next-verify/**",
      "**/.next-verify/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
