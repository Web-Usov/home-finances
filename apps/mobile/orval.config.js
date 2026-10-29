/**
 * Orval configuration — generates API client from backend OpenAPI spec.
 * Input is the committed apps/api/openapi.json (no running server needed).
 * Regenerate both with `pnpm api:generate` from the repo root.
 */
module.exports = {
  familyBudget: {
    input: {
      target: '../api/openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: './src/api',
      schemas: './src/api/model',
      client: 'react-query',
      override: {
        mutator: {
          path: './src/api/axios-instance.ts',
          name: 'customAxiosInstance',
        },
      },
    },
  },
};
