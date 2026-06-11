const app = require('./app');
const config = require('./config');

app.listen(config.port, () => {
  console.log(`GERPI Monitoring backend listening on http://localhost:${config.port}`);
});
