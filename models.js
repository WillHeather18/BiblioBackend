const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    uuid: { type: String },
    email: String,
    password: String,
    subscription: { type: String, default: 'none' },
    accountCreationDate: { type: Date, default: Date.now },
    lastLoginDate: { type: Date, default: Date.now },
  });
const User = mongoose.model('User', userSchema);
exports.User = User;

const recommendationSchema = new mongoose.Schema({
    uuid: { type: String },
    recommendations: [String],
  });
const Recommendations = mongoose.model('recommendations', recommendationSchema);
exports.Recommendations = Recommendations;

const userRatingsSchema = new mongoose.Schema({
    uuid: { type: String },
    ratings: [String],
  });
const UserRatings = mongoose.model('user_ratings', userRatingsSchema);
exports.UserRatings = UserRatings;