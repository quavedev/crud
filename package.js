/* global Package */
Package.describe({
  name: 'quave:crud',
  version: '0.1.0-beta.0',
  summary: 'Full CRUD easier than ever',
  git: 'https://github.com/quavedev/crud',
});

Package.onUse(api => {
  api.versionsFrom('1.10.2');
  api.use(['ecmascript']);
  api.use(['quave:forms@3.0.2']);

  api.addFiles('Crud.js', 'client');
  api.export('Crud', 'client');
});
