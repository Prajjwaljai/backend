import { Router } from "express";

import {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
} from "../controllers/comment.controller.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router();


// Get all comments for a video
router.route("/:videoId")
    .get(verifyJWT, getVideoComments)
    .post(verifyJWT, addComment);


// Update or delete a comment
router.route("/c/:commentId")
    .patch(verifyJWT, updateComment)
    .delete(verifyJWT, deleteComment);


export default router;