var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uuid: { type: String, default: "testuuid" },
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


    res.status(200).json({ status: "success", message: 'Logged in successfully'});
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error",message: 'Server error' });
  }
},
);

module.exports = router;
