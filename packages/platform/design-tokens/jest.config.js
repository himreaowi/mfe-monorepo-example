import { createJestConfig } from '@org/jest-config';

export default createJestConfig({
  rootDir: import.meta.dirname,
  environment: 'node',
});
