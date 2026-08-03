const { resolve } = require("node:path");

const project = resolve(process.cwd(), "tsconfig.json");

/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "eslint-config-prettier",
  ],
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project,
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "warn",
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "no-console": "warn",
  },
  overrides: [
    {
      files: ["*.native.ts", "*.native.tsx"],
      plugins: ["react-native"],
      extends: ["plugin:react-native/all"],
      env: {
        "react-native/react-native": true,
      },
      rules: {
        "react-native/no-unused-styles": "warn",
        "react-native/split-platform-components": "off",
      },
    },
    {
      files: ["*.config.*", "*.test.*", "*.spec.*"],
      rules: {
        "no-console": "off",
      },
    },
  ],
};
