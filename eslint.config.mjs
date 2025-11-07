import js from "@eslint/js";
import ts from "typescript-eslint";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";
import globals from "globals";

export default [
  { ignores: ["dist/**", ".vercel/**", "coverage/**", ".next/**", "node_modules/**", "next-env.d.ts", "scripts/**", "demonstration.js"] },

  js.configs.recommended,

  // TypeScript with type-aware rules
  ...ts.configs.recommendedTypeChecked.map(cfg => ({
    ...cfg,
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ...cfg.languageOptions,
      parserOptions: { project: ["tsconfig.json"] }
    }
  })),

  {
    files: ["**/*.{ts,tsx,js,jsx,cjs,mjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: { react, "react-hooks": hooks, "@next/next": next, "@typescript-eslint": ts.plugin },
    settings: { react: { version: "detect" } },
    rules: {
      // Core repo rules
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],

      // React rules
      "react/no-unescaped-entities": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Next.js best practices
      "@next/next/no-html-link-for-pages": "off"
    }
  }
];
