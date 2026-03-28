import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "functions/lib"]),

  // Node.js config files
  {
    files: ["*.config.js", "*.config.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // All source files
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      react,
    },
    settings: {
      react: { version: "detect" },
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]", args: "none" }],
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off",
    },
  },

  // shadcn UI files — relax react-refresh (they export helpers alongside components)
  {
    files: ["src/components/ui/**/*.jsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);
