const mongoose = require('mongoose')

const dataSchema = new mongoose.Schema({
  data: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  storyblokId: {
    type: String,
    required: true,
  },
  savedDate: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model('Data', dataSchema)
