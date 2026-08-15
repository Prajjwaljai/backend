import { Router } from "express";

import {
    toggleVideoLike,
    toggleCommentLike,
    toggleTweetLike,
    getLikedVideos
} from "../controllers/like.controller.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router();


// Toggle like/unlike on a video
router.route("/toggle/v/:videoId")
    .post(verifyJWT, toggleVideoLike);


// Toggle like/unlike on a comment
router.route("/toggle/c/:commentId")
    .post(verifyJWT, toggleCommentLike);


// Toggle like/unlike on a tweet
router.route("/toggle/t/:tweetId")
    .post(verifyJWT, toggleTweetLike);


// Get videos liked by the authenticated user
router.route("/videos")
    .get(verifyJWT, getLikedVideos);


export default router;