require('dotenv').config()
const WebSocket = require('ws')
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const DataModel = require('./models/DataModel')

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB')
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error)
  })

// Express setup
const app = express()
app.use(cors())
app.use(express.json())

const port = process.env.PORT || 3001
const wsPort = process.env.WS_PORT || 3002

// Create HTTP server for REST endpoints
app.listen(port, () => {
  console.log(`REST server is running on port ${port}`)
})

// WebSocket server setup
const wss = new WebSocket.Server({ port: wsPort })

// Broadcast to specific userId
const broadcast = (message, targetUserId) => {
  wss.clients.forEach((client) => {
    if (
      client.readyState === WebSocket.OPEN &&
      client.userId === targetUserId
    ) {
      client.send(JSON.stringify(message))
    }
  })
}

// REST endpoints
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' })
})

app.post('/api/save', async (req, res) => {
  try {
    const newData = new DataModel(req.body)
    const savedData = await newData.save()
    broadcast(
      {
        action: 'save_notification',
        status: 'success',
        data: savedData,
      },
      savedData.userId,
    )
    res.status(201).json(savedData)
  } catch (error) {
    console.error('Save error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/update/:id', async (req, res) => {
  try {
    const updatedData = await DataModel.findByIdAndUpdate(
      req.params.id,
      { ...req.body, savedDate: Date.now() },
      { new: true },
    )
    if (!updatedData) {
      return res.status(404).json({ error: 'Document not found' })
    }
    broadcast(
      {
        action: 'update_notification',
        status: 'success',
        data: updatedData,
      },
      updatedData.userId,
    )
    res.json(updatedData)
  } catch (error) {
    console.error('Update error:', error)
    res.status(500).json({ error: error.message })
  }
})

wss.on('connection', (ws) => {
  console.log('New client connected')

  ws.on('message', async (message) => {
    try {
      const { action, payload } = JSON.parse(message)

      switch (action) {
        case 'init': {
          // Store userId when client connects
          if (!payload.userId) {
            ws.send(
              JSON.stringify({
                action: 'error',
                status: 'error',
                message: 'userId is required for initialization',
              }),
            )
            ws.close()
            return
          }
          ws.userId = payload.userId
          ws.send(
            JSON.stringify({
              action: 'init_response',
              status: 'success',
              message: 'Connection initialized',
            }),
          )
          break
        }

        case 'get': {
          // Only allow querying for own userId
          const { userId, storyblokId } = payload
          if (userId !== ws.userId) {
            ws.send(
              JSON.stringify({
                action: 'error',
                status: 'error',
                message: 'Unauthorized: Can only query your own userId',
              }),
            )
            break
          }

          const query = { userId }
          if (storyblokId) query.storyblokId = storyblokId

          const data = await DataModel.find(query)
          ws.send(
            JSON.stringify({
              action: 'get_response',
              status: 'success',
              data,
            }),
          )
          break
        }

        default: {
          ws.send(
            JSON.stringify({
              action: 'error',
              status: 'error',
              message: 'Invalid action',
            }),
          )
          break
        }
      }
    } catch (error) {
      console.error('Error:', error)
      ws.send(
        JSON.stringify({
          action: 'error',
          status: 'error',
          message: error.message,
        }),
      )
    }
  })

  ws.on('close', () => {
    console.log('Client disconnected')
  })

  // Send a ping every 30 seconds to keep the connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping()
    }
  }, 30000)

  ws.on('close', () => {
    clearInterval(pingInterval)
    console.log('Client disconnected')
  })
})

console.log(`WebSocket server is running on port ${wsPort}`)
