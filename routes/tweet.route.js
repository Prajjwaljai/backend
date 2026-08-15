import { Router } from "express";

import {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
} from "../controllers/tweet.controller.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router();


// Create a tweet
router.route("/")
    .post(verifyJWT, createTweet);


// Get all tweets of a user
router.route("/user/:userId")
    .get(verifyJWT, getUserTweets);


// Update or delete a tweet
router.route("/:tweetId")
    .patch(verifyJWT, updateTweet)
    .delete(verifyJWT, deleteTweet);


export default router;