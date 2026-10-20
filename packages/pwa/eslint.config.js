import config from '@org/eslint-config';

// build/ is source here (the webpack/Workbox plugin, @org/pwa/build), not build output.
export default [...config, { ignores: ['!build/**'] }];
