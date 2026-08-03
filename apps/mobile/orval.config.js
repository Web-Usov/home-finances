/**
 * Orval configuration — generates API client from backend OpenAPI spec.
 * Run `pnpm orval` when the backend is running to regenerate.
 */
module.exports = {
  familyBudget: {
    input: {
      target: 'http://localhost:3000/api/swagger.json',
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
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
};
