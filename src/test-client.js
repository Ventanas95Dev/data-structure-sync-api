const WebSocket = require('ws')

// Use secure WebSocket (wss://) in production, ws:// in development
const WS_URL =
  process.env.NODE_ENV === 'production'
    ? 'wss://your-render-url' // Replace with your Render URL
    : 'ws://localhost:3001'

const ws = new WebSocket(WS_URL)

// Store the ID of the saved document for later update
let savedDocumentId = null

ws.on('open', () => {
  console.log('Connected to WebSocket server')

  // Test save operation
  const saveData = {
    action: 'save',
    payload: {
      data: 'Test data structure',
      userId: 'user123',
      storyblokId: 'story456',
    },
  }

  console.log('Sending save request:', saveData)
  ws.send(JSON.stringify(saveData))
})

ws.on('message', (data) => {
  const response = JSON.parse(data)
  console.log('Received response:', response)

  // If we got a successful save response, store the ID and test the update operation
  if (response.action === 'save_response' && response.status === 'success') {
    savedDocumentId = response.data._id

    // Test update operation
    const updateData = {
      action: 'update',
      payload: {
        id: savedDocumentId,
        data: 'Updated test data structure',
        userId: 'user123',
        storyblokId: 'story456',
      },
    }

    console.log('Sending update request:', updateData)
    ws.send(JSON.stringify(updateData))
  }
  // If we got a successful update response, test the get operation
  else if (
    response.action === 'update_response' &&
    response.status === 'success'
  ) {
    const getData = {
      action: 'get',
      payload: {
        userId: 'user123',
      },
    }

    console.log('Sending get request:', getData)
    ws.send(JSON.stringify(getData))
  }
})

ws.on('error', (error) => {
  console.error('WebSocket error:', error)
})

ws.on('close', () => {
  console.log('Disconnected from WebSocket server')
})

process.on('SIGINT', () => {
  console.log('Closing WebSocket connection...')
  ws.close()
  process.exit(0)
})
