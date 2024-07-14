const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({            //creating schema for user info
    name:String,
    email:String,
    password:String
});

module.exports = mongoose.model("users",userSchema);