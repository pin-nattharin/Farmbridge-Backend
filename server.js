// server.js (replacement)
const express = require('express');
const cors = require('cors');
const db = require('./models');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // ใส่ไฟล์นี้ด้วย

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/listings', require('./routes/listing.routes'));
app.use('/api/demands', require('./routes/demand.routes'));

const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// Simple in-memory map: userId -> Set(socketId)
const onlineUsers = new Map();

io.on('connection', (socket) => {
  // client should emit 'auth' with { userId } right after connect
  socket.on('auth', ({ userId }) => {
    if (!userId) return;
    const set = onlineUsers.get(userId) || new Set();
    set.add(socket.id);
    onlineUsers.set(userId, set);
    socket.userId = userId;
  });

  socket.on('disconnect', () => {
    const userId = socket.userId;
    if (userId) {
      const set = onlineUsers.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) onlineUsers.delete(userId);
        else onlineUsers.set(userId, set);
      }
    }
  });
});

// helper to emit to a userId
function emitToUser(userId, event, payload) {
  const set = onlineUsers.get(String(userId)) || onlineUsers.get(Number(userId));
  if (set && set.size > 0) {
    for (const sid of set) io.to(sid).emit(event, payload);
    return true;
  }
  return false;
}

// expose to other modules
app.locals.emitToUser = emitToUser;
app.locals.firebaseAdmin = admin;

db.sequelize.sync({ alter: true })
  .then(() => {
    console.log('✅ Database synced');
    httpServer.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
  })
  .catch(err => {
    console.error('DB sync failed', err);
  });
