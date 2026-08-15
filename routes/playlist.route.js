import { Router } from "express";

import {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
} from "../controllers/playlist.controller.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router();


// Create a new playlist
router.route("/")
    .post(verifyJWT, createPlaylist);


// Get all playlists created by a user
router.route("/user/:userId")
    .get(verifyJWT, getUserPlaylists);


// Get a specific playlist
router.route("/:playlistId")
    .get(verifyJWT, getPlaylistById)
    .patch(verifyJWT, updatePlaylist)
    .delete(verifyJWT, deletePlaylist);


// Add a video to a playlist
router.route("/add/:videoId/:playlistId")
    .post(verifyJWT, addVideoToPlaylist);


// Remove a video from a playlist
router.route("/remove/:videoId/:playlistId")
    .delete(verifyJWT, removeVideoFromPlaylist);


export default router;