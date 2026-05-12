// Tells React Native CLI to autolink the iOS pod and Android module
// shipped inside this package. CommonJS — RN CLI's config loader uses
// `require()` synchronously, so this file must not be ESM.
const path = require('path');

module.exports = {
  dependency: {
    platforms: {
      ios: {
        podspecPath: path.join(__dirname, 'owlscope.podspec'),
      },
      android: {
        sourceDir: './android',
      },
    },
  },
};
