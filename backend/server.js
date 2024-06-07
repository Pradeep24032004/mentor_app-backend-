const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const BASE_URL = process.env.BASE_URL;
const DATABASE_URL = process.env.DATABASE_URL;
const PORT = process.env.PORT || 5000;

const app = express();

app.use(express.json());
app.use(cors()); 

// MongoDB connection
mongoose.connect('mongodb+srv://pradeep24032004:g2QVJPiGHKeBvM4K@cluster0.hckr8qg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0').then(() => console.log('MongoDB connected')).catch(err => console.log(err));
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  googleId: { type: String }
});

const questionSchema = new mongoose.Schema({
  question: String,
  description: String,
  userEmail: String,
  mentorRequests: [String], 
  acceptedMentor: String,
  codeInput: [{
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  ansOutput: [{
    content: String,
    timestamp: { type: Date, default: Date.now }
  }]
});
const MentorSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  //profilePicture: { type: String },
  mgrid: { type: String, required: true }
});
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});


const User = mongoose.model('User', UserSchema);

const Question = mongoose.model('Question', questionSchema);

const Mentor = mongoose.model('Mentor', MentorSchema);
// Register
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }
    user = new User({ name, email, password });
    await user.save();
    res.json({ msg: 'User registered successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});
app.post('/mentorsignup', async (req, res) => {
  try {
    const { username, email, password, name, mgrid } = req.body;
    if (mgrid !== '2445') {
      return res.status(400).json({ message: 'Invalid manager ID' });
    }

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if user already exists
    const existingUser = await Mentor.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Create new user
    const newUser = new Mentor({
      username,
      email,
      password,
      name,
      mgrid,
     
    });

    await newUser.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
app.post('/mentorsignin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Check if user exists
    const user = await Mentor.findOne({ email, password });
    if (user) {
      // Successful sign-in
      return res.status(200).json({ success: true, message: 'Sign in successful' });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Sign in error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    res.json({ msg: 'Login successful' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

app.get('/user', async (req, res) => {
  const { email } = req.query;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
app.get('/mentor', async (req, res) => {
  const { email } = req.query;

  try {
    const user = await Mentor.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/questions', async (req, res) => {
  const { email } = req.query;
  const questions = await Question.find({ userEmail: email }).populate('mentorRequests').populate('acceptedMentor');
  res.json(questions);
});
app.get('/resquestions', async (req, res) => {
  try {
      const mentorEmail = req.query.mentorEmail;
      const questions = await Question.find({ acceptedMentor: mentorEmail });
      res.json(questions);
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
});

app.get('/allquestions', async (req, res) => {
  //const { email } = req.query;
  const questions = await Question.find().populate('mentorRequests').populate('acceptedMentor');
  res.json(questions);
});
app.post('/questions', async (req, res) => {
  const {userEmail, question, description } = req.body;
  const newQuestion = new Question({userEmail, question, description });
  await newQuestion.save();
  res.json(newQuestion);
});

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'projectplazapro@gmail.com',
    pass: 'bynw qsyz fbqy guvq'
  }
});

// API to handle mentor request and send email
app.post('/questions/:id/request', async (req, res) => {
  const { mentorEmail } = req.body;
  const question = await Question.findById(req.params.id);

  if (question.mentorRequests.includes(mentorEmail)) {
    return res.status(400).json({ error: 'You have already requested this question.' });
  }

  question.mentorRequests.push(mentorEmail);
  await question.save();

  // Send email to the user
  const mailOptions = {
    from: 'projectplazapro@gmail.com',
    to: question.userEmail,
    subject: 'New Mentor Request',
    text: `You have a new mentor request from ${mentorEmail} for your question: ${question.question}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log('Email sent: ' + info.response);
  });

  res.json(question);
});


app.post('/questions/:id/accept', async (req, res) => {
  const { acceptedMentor } = req.body;
  try {
    const question = await Question.findByIdAndUpdate(req.params.id, { acceptedMentor }, { new: true });
    res.json({ acceptedMentor: question.acceptedMentor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}); 

/*(correct one)
app.post('/questions/:id/codeInput', async (req, res) => {
  const { codeInput } = req.body;
  try {
    const question = await Question.findByIdAndUpdate(req.params.id, { $push: { codeInput: { content: codeInput } } }, { new: true });
    res.json({ codeInput: question.codeInput });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
*/
// Create a Nodemailer transporter
const transporter1 = nodemailer.createTransport({
  service: 'Gmail', // e.g., 'gmail'
  auth: {
    user: 'projectplazapro@gmail.com',
    pass: 'bynw qsyz fbqy guvq'
  }
});

app.post('/questions/:id/codeInput', async (req, res) => {
  const { codeInput } = req.body;
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id, 
      { $push: { codeInput: { content: codeInput } } }, 
      { new: true }
    );

    if (question) {
      // Send email to accepted mentor
      const mailOptions = {
        from: 'projectplazapro@gmail.com',
        to: question.acceptedMentor,
        subject: 'New Code Input Added',
        text: `A new code input has been added to the question: ${question.question}\n\nCode Input: ${codeInput}`
      };

      transporter1.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log('Error sending email:', error);
        } else {
          console.log('Email sent:', info.response);
        }
      });

      res.json({ codeInput: question.codeInput });
    } else {
      res.status(404).json({ message: 'Question not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
/*
// Add answer output
app.post('/questions/:id/ansOutput', async (req, res) => {
  const { content } = req.body;
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { $push: { ansOutput: { content } } },
      { new: true }
    );
    res.json({ ansOutput: question.ansOutput });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}); */

// Create a Nodemailer transporter
const transporter2 = nodemailer.createTransport({
  service: 'Gmail', // e.g., 'gmail'
  auth: {
    user: 'projectplazapro@gmail.com',
    pass: 'bynw qsyz fbqy guvq'
  }
});

// Endpoint to add answer output
app.post('/questions/:id/ansOutput', async (req, res) => {
  const { content } = req.body;
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { $push: { ansOutput: { content } } },
      { new: true }
    );

    if (question) {
      // Send email notification to the user
      const mailOptions = {
        from: 'projectplazapro@gmail.com',
        to: question.userEmail,
        subject: 'New Answer Output Added',
        text: `An answer output has been added to your question:\n\nQuestion: ${question.question}\n\nAnswer Output: ${content}`
      };

      transporter2.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log('Error sending email:', error);
        } else {
          console.log('Email sent:', info.response);
        }
      });

      res.json({ ansOutput: question.ansOutput });
    } else {
      res.status(404).json({ message: 'Question not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on ${BASE_URL}`);
});