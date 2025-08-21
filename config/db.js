const mongoose = require("mongoose");

const connectDB = async function (){
    try {
        await mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("MongoDB Connected"))
        .catch(err => console.error("MongoDB Error",err));
    } catch (error) {
        console.error(`Database connection error ${error.message}`);
        process.exit(1);
    }
}

module.exports = connectDB;