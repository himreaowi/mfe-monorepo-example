import { readFileSync } from 'node:fs';
import { createShellConfig } from '@org/rspack-config';

// Port and federation name live in package.json ("mfe"), so tools (check-apps, gen:remote) and
// this config read the same values.
const { mfe } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);

export default createShellConfig({
  rootDir: import.meta.dirname,
  name: mfe.federationName,
  port: mfe.port,
  title: 'Citizen Portal',
});
