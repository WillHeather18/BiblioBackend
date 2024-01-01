var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var { v4: uuidv4 } = require('uuid');
const argon2 = require('argon2');


const userSchema = new mongoose.Schema({
  uuid: { type: String, default: uuidv4() },
  email: String,
  password: String,
  accountCreationDate: { type: Date, default: Date.now },
  lastLoginDate: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

/* GET users listing. */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(email);

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ status: "failure",message: 'User not found' });
    }

    const isMatch = await argon2.verify(password, user.password);

    if (!isMatch) {
          return res.status(400).json({ status: "failure", message: 'Invalid password' });
    }

    const userObject = user.toObject();

    // Delete the password property
    delete userObject.password;


    res.status(200).json({ status: "success", message: 'Logged in successfully',  data: userObject});
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

    const hashedPassword = await argon2.hash(password);

    const user = new User({ email, password: hashedPassword});
    await user.save();

    res.status(200).json({ status: "success", message: 'User created successfully', data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: 'Server error' });
  }
});

module.exports = router;
