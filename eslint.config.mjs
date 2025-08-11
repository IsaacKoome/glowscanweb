import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import next from "@next/eslint-plugin-next";
import typescriptEslint from "@typescript-eslint/eslint-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: [".next/**"],
  },
  // Your custom rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "@next/next": next
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-page-custom-font": "off",
      "@next/next/no-html-link-for-pages": "error"
    }
  },
  
  // Compat layer for existing configs
  ...compat.config({
    extends: [
      "next/core-web-vitals", 
      "next/typescript"
    ]
  }),
];

export default eslintConfig;
