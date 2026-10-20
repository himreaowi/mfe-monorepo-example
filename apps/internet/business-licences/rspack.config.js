import { readFileSync } from 'node:fs';
import { createRemoteConfig } from '@org/rspack-config';

// Port and federation name live in package.json ("mfe"), so tools and this config agree.
const { mfe } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);

export default createRemoteConfig({
  rootDir: import.meta.dirname,
  name: mfe.federationName,
  port: mfe.port,
  title: 'Business licences',
  // exposes: { './App': './src/app/apps.tsx' } (default)
});
