require('dotenv').config()
const bodyParser = require('body-parser')
const cors = require('cors')
const express = require('express')
const mongoose = require('mongoose')

const app = express()
app.use(cors())
app.use(express.static('public'))

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// Connect to mongodb
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

// Models

const ExerciseSchema = new mongoose.Schema({
  username: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, required: true },
})

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
})

const UserModel = mongoose.model('User', UserSchema)
const ExerciseModel = mongoose.model('Exercise', ExerciseSchema)

UserModel.countDocuments({}).exec(function (err, userCount) {
  if (userCount === 0) {
    console.log('userCount === 0, Creating initial data.')
    const initialUser = new UserModel({
      _id: '64f73b17eb93f351988b1693',
      username: 'fcc_test',
    })

    initialUser.save((err, initialUser) => {
      const initialExercise = new ExerciseModel({
        username: initialUser.username,
        description: 'test',
        duration: 60,
        date: new Date('1990-01-01'),
      })

      initialExercise.save()
    })
  }
})

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

//
// API
//
app.get('/api/users', (req, res) => {
  UserModel.find({}, (err, data) => {
    return res.json(data)
  })
})

app.post('/api/users', (req, res) => {
  /** @type {String} */
  const username = req.body.username

  if (!username) {
    return res.status(400).json({ message: 'Invalid username' })
  }

  // TODO-LOL: not handling upper and lower case and locale stuff
  UserModel.findOne({ username: username }, (err, existingUser) => {
    if (existingUser !== null) {
      return res.status(400).json({ message: 'Username already taken' })
    }

    // Create and save user
    const user = new UserModel({ username: username })
    user.save((err, user) => {
      return res.json(user.toObject({ versionKey: false })) // TODO-LOL: not handling remove `__v:0`
    })
  })
})

app.post('/api/users/:_id/exercises', (req, res) => {
  // LOL: performance
  const userId = String(req.params._id) // from params
  const description = String(req.body['description'])
  const duration = Number(req.body['duration'])

  const date = req.body['date'] ? new Date(req.body['date']) : new Date()
  date.setHours(0, 0, 0, 0)

  // Get username
  UserModel.findById(userId, (err, user) => {
    if (!user) {
      return res.status(404).json('User not found')
    }

    // Create and save exercise
    const exercise = new ExerciseModel({
      username: user.username,
      description: description,
      duration: duration,
      date: date,
    })

    exercise.save((err, savedExercise) => {
      const exerciseObj = savedExercise.toObject({ versionKey: false })

      return res.json({
        ...exerciseObj,
        _id: userId,
        date: exerciseObj.date.toDateString(),
      })
    })
  })
})

app.get('/api/users/:_id/logs', (req, res) => {
  const { _id } = req.params

  UserModel.findById(_id, (err, user) => {
    if (err) {
      return res.status(404).json({ message: err.message }) // security: lol
    }
    if (user === null) {
      return res.status(404).json({ message: `User ${_id} not found.` })
    }

    /** @type {String} */
    const username = user.username

    let limit = null
    let dateTo = null
    let dateFrom = null

    let query = ExerciseModel.find({ username: username })

    if (req.query.dateFrom) {
      dateFrom = new Date(req.query.dateFrom)
      query = query.where('date').gte(dateFrom)
    }

    if (req.query.dateTo) {
      dateTo = new Date(req.query.dateTo)
      query = query.where('date').lte(dateTo)
    }

    if (req.query.limit) {
      limit = Number(req.query.limit)
      query = query.limit(limit)
    }

    query = query.select({ _id: 0, username: 0, __v: 0 })

    query.exec((err, exercises) => {
      //
      const exercisesArr = exercises.map((item) => {
        return {
          ...item.toObject(),
          date: item.date.toDateString(),
        }
      })

      return res.json({
        _id: _id,
        username: username,
        count: exercises ? exercises.length : 0,
        log: exercises ? exercisesArr : [],
      })
    })
  })
})

app.delete('/api/reset-db', (req, res) => {
  ExerciseModel.deleteMany({}, (err, result) => {
    // console.log(result)
    UserModel.deleteMany({}, (err, result) => {
      // console.log(result)
      return res.json({ message: 'Delete success' })
    })
  })
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
