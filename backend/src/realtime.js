// Socket.IO live updates. Clients authenticate with their JWT and join
// visibility rooms; new alerts are pushed only to sockets allowed to see them.
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');

let io = null;

function init(httpServer) {
  io = new Server(httpServer, { cors: { origin: config.corsOrigins } });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      const payload = jwt.verify(token, config.jwt.accessSecret);
      const user = await db('users').where({ id: payload.sub, is_active: true }).whereNull('deleted_at').first();
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.data.user;
    if (u.role === 'admin' || u.role === 'mof_supervisor') socket.join('supervisors');
    else if (u.role === 'ministry_officer' && u.ministry_id) socket.join('ministry:' + u.ministry_id);
    else if (u.role === 'gerpi_staff' && u.gerpi_id) socket.join('gerpi:' + u.gerpi_id);
    else if (u.role === 'donor_viewer' && u.donor_id) socket.join('donor:' + u.donor_id);
  });

  return io;
}

// org: { id, ministry_id, donor_id, name_uz_latn }
function emitAlert(alert, org) {
  if (!io) return;
  const payload = { ...alert, gerpi_name: org.name_uz_latn };
  io.to('supervisors')
    .to('ministry:' + org.ministry_id)
    .to('gerpi:' + org.id)
    .to('donor:' + org.donor_id)
    .emit('alert:new', payload);
}

module.exports = { init, emitAlert };
