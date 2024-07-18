require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser'); // Middleware for parsing request bodies
const User = require('./DB/users');
const Product = require('./DB/products');
const JWT = require('jsonwebtoken');

const app = express();
const JWT_KEY = process.env.JWT_SECRET_KEY;
const DB_URI = process.env.DB_URI;

if (!JWT_KEY) {
    console.error("JWT_SECRET_KEY is not defined in environment variables");
    process.exit(1); // Exit the process or handle accordingly if JWT_KEY is missing
}

if (!DB_URI) {
    console.error("DB_URI is not defined in environment variables");
    process.exit(1); // Exit the process or handle accordingly if DB_URI is missing
}

// Connect to MongoDB
mongoose.connect(DB_URI)
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

// Middleware to parse JSON
app.use(express.json());
app.use(cors()); // to fix CORS issue - Cross-Origin Resource Sharing (CORS)

app.get("/", (req, resp) => {
    try {
        resp.send("app is working...");
    } catch (err) {
        console.log("ERROR");
    }
});

// Register route
app.post("/register", async (req, res) => {
    try {
        let user = new User(req.body);
        let result = await user.save(); // saving the user info in DB
        result = result.toObject();
        delete result.password; // Encryting passwords
        JWT.sign({ result }, JWT_KEY, { expiresIn: "2h" }, (err, token) => {
            if (err) {
                return res.send({ result: "Something went wrong, Please try after some time" });
            }
            return res.send({ result, auth: token });
        });
    } catch (error) {
        console.log("ERROR");
    }
});

// Login route
app.post("/login", async (req, resp) => {
    try {
        if (req.body.password && req.body.email) {
            let user = await User.findOne(req.body).select("-password");

            if (user) {
                JWT.sign({ user }, JWT_KEY, { expiresIn: "2h" }, (err, token) => {
                    if (err) {
                        console.error("JWT sign error:", err);
                        return resp.status(500).send({ result: "Something went wrong, Please try after some time" });
                    }
                    return resp.send({ user, auth: token });
                });
            } else {
                return resp.status(404).send({ result: "User not found" });
            }
        } else {
            return resp.status(400).send({ result: "Email and password are required" });
        }
    } catch (error) {
        console.error("Login error:", error);
        return resp.status(500).send({ result: "Internal server error" });
    }
});

// Add product route
app.post("/add-product", verifyToken, async (req, resp) => {
    try {
        const userId = req.user.id;
        let product = new Product({...req.body,userID:userId});         //unique to all users
        let result = await product.save();
        resp.send(result);
    }catch (err) {
        console.log("ERROR")
        resp.status(500).send({ result: "Internal Server Error" });
    }
});

// Get all products
app.get("/products", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        let products = await Product.find({ userID: userId });      //filtering products on basis of userid
        if (products.length > 0) {
            res.send(products);
        } else {
            res.send({ result: "No Products Found." });
        }
    } catch (err) {
        console.log("ERROR")
        res.status(500).send({ result: "Internal Server Error" });
    }
});

// Delete product
app.delete("/product/:id", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await Product.deleteOne({ _id: req.params.id, userID:userId});
        res.send(result);
    } catch (err) {
        console.log("ERROR")
        res.status(500).send({ result: "Internal Server Error" });
    }
});

// Get product by ID
app.get("/product/:id", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        let result = await Product.findOne({ _id: req.params.id, userID:userId });
        if (result) {
            res.send(result);
        } else {
            res.send({ result: "No Record Found." });
        }
    } catch (error) {
        console.log("ERROR")
        res.status(500).send({ result: "Internal Server Error" });
    }
});

// Update product
app.put("/product/:id", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        let result = await Product.updateOne(
            { _id: req.params.id, userID: userId }, // Ensuring the product belongs to the user
            {
                $set: req.body,
            }
        ); // 2parameters: jiske bases pr update krna h, jisse update krna h
        res.send(result);
    } catch (error) {
        console.log("ERROR");
        res.status(500).send({ result: "Internal Server Error" });
    }
});

// Search products
app.get("/search/:key", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        let result = await Product.find({
            userID: userId, // Ensure products are filtered by the user's ID
            "$or": [
                { name: { $regex: req.params.key, $options: 'i' } },
                { company: { $regex: req.params.key, $options: 'i' } },
                { category: { $regex: req.params.key, $options: 'i' } }
            ]
        });
        res.send(result);
    } catch (error) {
        console.log("ERROR");
        res.status(500).send({ result: "Internal Server Error" });
    }
});

// Middleware to verify token
function verifyToken(req, resp, next) {
    try {
        let token = req.headers['authorization']; // they are case in-sensative and always lowercase
        if (token) {
            token = token.split(' ')[1];
            console.warn("middleware called", token);
            JWT.verify(token, JWT_KEY, (error, valid) => {
                if (error) {
                    resp.status(401).send({ result: "Please provide valid token!" });
                } else {
                    req.user = valid.user; // Attach user info to the request
                    next();
                }
            });
        } else {
            resp.status(403).send({ result: "Token not found, please add token with header!" });
        }
    } catch (error) {
        console.log("ERROR");
        resp.status(500).send({ result: "Internal Server Error" });
    }
}

const PORT = process.env.PORT || 5000; // Default to 5000 for local development

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});