var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
var jwt = require('jsonwebtoken');
const { Recommendations, UserRatings } = require('../models.js');

// JWT Validation Middleware
function validateJwt(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
  
    if (token == null) {
      return res.sendStatus(401); // if there's no token
    }
  
    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
      if (err) {
        return res.sendStatus(403); // if the token is invalid or expired
      }
  
      req.user = user;
      next(); // proceed to the next middleware/route handler
    });
  }

router.get('/getrecommendations/:uuid', validateJwt, async (req, res) => {
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

  router.post('/updaterecommendations', validateJwt, async (req, res) => {
    const uuid = req.body.uuid;

    try{
        const userRatings = await UserRatings.findOne({ uuid: uuid }); 

        if (!userRatings) {
            return res.status(404).json({ status: "failure", message: 'No recommendations found for the provided uuid' });
        }

        let ratingsObject = {};
        userRatings.ratings.forEach(rating => {
            let [key, value] = rating.split(': ');
            key = key.replace(/"/g, ''); // remove quotes from key
            ratingsObject[key] = parseInt(value);
        });
        const ratingsJson = JSON.stringify(ratingsObject);

        // Run Python script
        const python = spawn('python', ['ML/Hybrid.py', ratingsJson, '5']);

        let scriptOutput = "";
        python.stdout.on('data', (data) => {
            scriptOutput += data.toString();
        });

        // In case of error
        python.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        // Script finish
        python.on('close', async (code) => {
            try {
                scriptOutput = scriptOutput.replace(/'/g, '"'); // replace single quotes with double quotes
                let outputArray = JSON.parse(scriptOutput); // parse the JSON string into an array
        
                // Find a Recommendations document with a uuid that matches uuid and update it
                let updatedRecommendation = await Recommendations.findOneAndUpdate(
                    { uuid: uuid }, // filter
                    { recommendations: outputArray }, // update
                    { new: true } // options
                );
        
                if (!updatedRecommendation) {
                    return res.status(404).json({ status: "failure", message: 'No recommendation found with this uuid' });
                }
        
                // Send the updated document in the response
                res.status(200).json({ status: "success", message: 'Recommendations updated successfully', data: updatedRecommendation });
            } catch (err) {
                console.error(err);
                return res.status(500).json({ status: "failure", message: 'Database error' });
            }
        });

    }catch (err) {
        console.error(err)
        return res.status(404).json({ status: "failure", message: 'server error' });
    }


});

  module.exports = router;