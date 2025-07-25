import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // 1. Add your custom top-level rules as a plain object
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-page-custom-font": "off",
    }
  },
  // 2. Then spread in the compat configs, so your rules have priority
  ...compat.config({
    extends: [
      "next/core-web-vitals",
      "next/typescript",
    ],
  }),
];

export default eslintConfig;
