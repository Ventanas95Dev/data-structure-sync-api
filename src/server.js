require('dotenv').config()
const WebSocket = require('ws')
const mongoose = require('mongoose')
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

const port = process.env.PORT || 3001
const wss = new WebSocket.Server({
  port,
  perMessageDeflate: {
    zlibDeflateOptions: {
      // See zlib defaults.
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024,
    },
    // Other options settable:
    clientNoContextTakeover: true, // Defaults to negotiated value.
    serverNoContextTakeover: true, // Defaults to negotiated value.
    serverMaxWindowBits: 10, // Defaults to negotiated value.
    // Below options specified as default values.
    concurrencyLimit: 10, // Limits zlib concurrency for perf.
    threshold: 1024, // Size (in bytes) below which messages
    // should not be compressed if context takeover is disabled.
  },
})

wss.on('connection', (ws) => {
  console.log('New client connected')

  ws.on('message', async (message) => {
    try {
      const { action, payload } = JSON.parse(message)

      switch (action) {
        case 'save':
          const newData = new DataModel(payload)
          const savedData = await newData.save()
          ws.send(
            JSON.stringify({
              action: 'save_response',
              status: 'success',
              data: savedData,
            }),
          )
          break

        case 'update':
          const { id, ...updateData } = payload
          const updatedData = await DataModel.findByIdAndUpdate(
            id,
            {
              ...updateData,
              savedDate: Date.now(),
            },
            { new: true },
          )

          if (!updatedData) {
            ws.send(
              JSON.stringify({
                action: 'update_response',
                status: 'error',
                message: 'Document not found',
              }),
            )
            break
          }

          ws.send(
            JSON.stringify({
              action: 'update_response',
              status: 'success',
              data: updatedData,
            }),
          )
          break

        case 'get':
          const { userId, storyblokId } = payload
          const query = {}
          if (userId) query.userId = userId
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

        default:
          ws.send(
            JSON.stringify({
              action: 'error',
              status: 'error',
              message: 'Invalid action',
            }),
          )
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

console.log(`WebSocket server is running on port ${port}`)
