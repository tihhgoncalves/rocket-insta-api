const path = require('node:path');
module.exports = {
  cacheDirectory: path.join(__dirname, '.local', 'browsers'),
  'chrome-headless-shell': { skipDownload: true },
};
