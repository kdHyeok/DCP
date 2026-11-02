const path = require('node:path');
const inject = require('./inject.cjs');

inject('troubleshooting', () => `템플릿: ${path.join(__dirname, '../skills/troubleshooting/template.md')}`);
