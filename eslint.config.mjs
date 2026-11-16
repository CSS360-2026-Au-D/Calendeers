import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["build/**", "coverage/**", "node_modules/**", ".claude/**", ".omc/**"] },
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.node } },
  {
    // Test mocks mirror Discord.js method signatures, so unused parameters are expected there.
    files: ["tests/**/*.js"],
    languageOptions: { globals: globals.mocha },
    rules: { "no-unused-vars": ["error", { args: "none" }] },
  },
]);
