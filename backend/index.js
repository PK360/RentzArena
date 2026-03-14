const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const socketManager = require('./socketManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Basic Route for health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Rentz Arena Backend Running!' });
});

// Initialize Socket.io Multiplayer Logic
socketManager(io);

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rentz-arena';

// Connect to MongoDB and start the server
/*
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
  });
*/

// For now, start server without DB strictly enforcing (will uncomment when schema is ready)
server.listen(PORT, () => console.log(`Server running on port ${PORT} (DB not strictly connected yet)`));
