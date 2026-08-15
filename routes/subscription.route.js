import { Router } from "express";

import {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
} from "../controllers/subscription.controller.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router();


// Subscribe / unsubscribe + get channel subscribers
router.route("/c/:channelId")
    .post(verifyJWT, toggleSubscription)
    .get(verifyJWT, getUserChannelSubscribers);


// Get channels subscribed to by a user
router.route("/u/:subscriberId")
    .get(verifyJWT, getSubscribedChannels);


export default router;