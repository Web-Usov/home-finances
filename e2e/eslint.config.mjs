import { node } from '@family-budget/eslint-config';

export default [...node, { ignores: ['playwright-report/**', 'test-results/**', '.web/**'] }];
