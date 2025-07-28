import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import next from "@next/eslint-plugin-next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  // Your custom rules
  {
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
      "@next/next": next
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-page-custom-font": "off"
    }
  },
  
  // Compat layer for existing configs
  ...compat.config({
    extends: [
      "next/core-web-vitals", 
      "next/typescript"
    ]
  }),
  
  // Additional Next.js recommended config
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@next/next/no-html-link-for-pages": "error"
    }
  }
];