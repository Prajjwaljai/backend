import { Router } from "express";

import {
    getChannelStats,
    getChannelVideos
} from "../controllers/dashboard.controller.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router();


// Get statistics for the authenticated user's channel
router.route("/stats")
    .get(verifyJWT, getChannelStats);


// Get all videos uploaded by the authenticated user
router.route("/videos")
    .get(verifyJWT, getChannelVideos);


export default router;