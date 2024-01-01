const e = require('express');
var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const recommendationSchema = new mongoose.Schema({
    uuid: { type: String, default: uuidv4() },
    recommendations: [String],
});

const Recommendations = mongoose.model('recommendations', recommendationSchema);

router.get('/recommendations/:uuid', async (req, res) => {
    try {
        const uuid = req.params.uuid;
        const recommendations = await Recommendations.find({ uuid: uuid });
  
        if (!recommendations || recommendations.length === 0) {
            return res.status(404).json({ status: "failure", message: 'No recommendations found for the provided uuid' });
        }
  
        res.status(200).json({ status: "success", recommendations: recommendations });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: 'Server error' });
    }
  });

  module.exports = router;