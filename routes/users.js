var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
const { User, Recommendations, UserRatings } = require('../models.js');
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

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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

router.post('/deleteuser', async (req, res) => {
  const { uuid } = req.body;

  try {
    await UserRatings.deleteOne({ uuid });
    await Recommendations.deleteOne({ uuid });
    await User.deleteOne({ uuid });
    
    res.status(200).json({ status: "success", message: 'User records deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: 'Server error' });
  }
});


module.exports = router;
