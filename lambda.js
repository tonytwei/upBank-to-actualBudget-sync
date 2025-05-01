const serverlessExpress = require('@codegenie/serverless-express');
const app = require('./server'); // No `.default` if you're using CommonJS

exports.handler = serverlessExpress({ app: app.callback() });
