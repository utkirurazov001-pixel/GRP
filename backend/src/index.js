const http = require('http');
const app = require('./app');
const config = require('./config');
const realtime = require('./realtime');
const scheduler = require('./jobs/scheduler');

const server = http.createServer(app);
realtime.init(server);
scheduler.start();

server.listen(config.port, () => {
  console.log(`GERPI Monitoring backend listening on http://localhost:${config.port}`);
});
