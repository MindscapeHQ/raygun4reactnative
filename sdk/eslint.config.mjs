import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";


/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    settings: {
      // The oldest React in the peer dependency range. "detect" calls context.getFilename(),
      // which ESLint 10 removed, so eslint-plugin-react 7.37.5 crashes with it.
      react: { version: "19.1" },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": 0,
      "@typescript-eslint/no-explicit-any": 0,
      "@typescript-eslint/no-require-imports": 0,
    },
  },
];