require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const createApp = require('./src/app');
const registerSocketHandlers = require('./socketManager');

const PORT = Number(process.env.PORT || 4000);
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rentz-arena';

async function connectToMongo() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.warn(
      'MongoDB unavailable, continuing with degraded in-memory mode:',
      error.message
    );
  }
}

function start() {
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  registerSocketHandlers(io);

  server.on('error', (error) => {
    console.error('Failed to start backend listener', error);
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`Rentz Arena backend listening on port ${PORT}`);
  });

  mongoose.connection.on('error', (error) => {
    console.warn('MongoDB connection error:', error.message);
  });

  void connectToMongo();
}

start();
