var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');


const userSchema = new mongoose.Schema({
  uuid: { type: String },
  email: String,
  password: String,
  accountCreationDate: { type: Date, default: Date.now },
  lastLoginDate: { type: Date, default: Date.now },
});

const recommendationSchema = new mongoose.Schema({
  uuid: { type: String, default: uuidv4() },
  recommendations: [String],
});

const userRatingsSchema = new mongoose.Schema({
  uuid: { type: String, default: uuidv4() },
  ratings: {},
});

const User = mongoose.model('User', userSchema);
const Recommendations = mongoose.model('recommendations', recommendationSchema);
const UserRatings = mongoose.model('user_ratings', userRatingsSchema);

/* GET users listing. */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ status: "failure",message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
          return res.status(400).json({ status: "failure", message: 'Invalid password' });
    }

    const userObject = user.toObject();

    // Delete the password property
    delete userObject.password;

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });

    res.status(200).json({ status: "success", message: 'Logged in successfully',  data: userObject, token: token});
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error",message: 'Server error' });
  }
},
);

router.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

  if (!emailRegex.test(email)) {
      return res.status(400).json({ status: "failure", message: 'Invalid email format' });
  }

  try {
    console.log(`Creating user with email: ${email}`);
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ status: "failure", message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const uuid = uuidv4();

    const user = new User({ uuid, email, password: hashedPassword});
    await user.save();

    const recommendations = new Recommendations({ uuid, recommendations: []});
    await recommendations.save();

    const userRatings = new UserRatings({ uuid, ratings: {}});
    await userRatings.save();

    res.status(200).json({ status: "success", message: 'User created successfully', data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: 'Server error' });
  }
});

module.exports = router;
