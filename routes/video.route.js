import { Router } from "express";

import {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
} from "../controllers/video.controller.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";


const router = Router();


// Get all published videos
// Authentication is not required here.
router.route("/")
    .get(getAllVideos)

    // Publish/upload a video
    .post(
        verifyJWT,
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1
            },
            {
                name: "thumbnail",
                maxCount: 1
            }
        ]),
        publishAVideo
    );


// Get, update or delete a specific video
router.route("/v/:videoId")
    .get(verifyJWT, getVideoById)
    .patch(
        verifyJWT,
        upload.single("thumbnail"),
        updateVideo
    )
    .delete(
        verifyJWT,
        deleteVideo
    );


// Toggle published/unpublished status
router.route("/toggle/publish/:videoId")
    .patch(
        verifyJWT,
        togglePublishStatus
    );


export default router;