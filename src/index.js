import dotenv from 'dotenv';
import express from 'express';
import connectDB from '../db/index.js';
import app from './app.js';


dotenv.config({
    path: './.env'
})
connectDB()
.then(()=>{
    app.on("error", (err) => {
            console.error("Error connecting to MongoDB:", err);
            throw err;
        });
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running on port ${process.env.PORT || 8000}`);
    });
})
.catch((err) => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
});
 



/*
const app = express();
;(async () =>{
    try {
        await mongoose.connect(`{process.env.MONGODB_URI}/${DB_NAME}`);
        app.on("error", (err) => {
            console.error("Error connecting to MongoDB:", err);
            throw err;
        });

        app.listen(process.env.PORT, () => {
            console.log(`Server is running on port ${process.env.PORT}`);
        });
    }catch (error) {
        console.error("Error starting server:", error);
        throw error;
    }
})()

*/