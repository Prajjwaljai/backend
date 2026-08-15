import mongoose from "mongoose";

import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    if (
        typeof name !== "string" ||
        !name.trim()
    ) {
        throw new ApiError(400, "Playlist name is required");
    }

    if (
        typeof description !== "string" ||
        !description.trim()
    ) {
        throw new ApiError(400, "Playlist description is required");
    }

    const playlist = await Playlist.create({
        name: name.trim(),
        description: description.trim(),
        owner: req.user._id
    });

    if (!playlist) {
        throw new ApiError(
            500,
            "Failed to create playlist. Please try again"
        );
    }

    return res.status(201).json(
        new ApiResponse(
            201,
            "Playlist created successfully",
            playlist
        )
    );
});


const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    const playlists = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },

        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos"
            }
        },

        {
            $addFields: {
                totalVideos: {
                    $size: "$videos"
                },

                totalViews: {
                    $sum: "$videos.views"
                }
            }
        },

        {
            $project: {
                _id: 1,
                name: 1,
                description: 1,
                totalVideos: 1,
                totalViews: 1,
                createdAt: 1,
                updatedAt: 1
            }
        },

        {
            $sort: {
                updatedAt: -1
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            "User playlists fetched successfully",
            playlists
        )
    );
});


const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    if (!mongoose.isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    const playlist = await Playlist.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },

        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos"
            }
        },

        /*
         * Only return published videos in the playlist.
         *
         * Since the videos are stored as an array reference,
         * filtering here prevents unpublished videos from
         * being exposed through this endpoint.
         */
        {
            $addFields: {
                videos: {
                    $filter: {
                        input: "$videos",
                        as: "video",
                        cond: {
                            $eq: [
                                "$$video.isPublished",
                                true
                            ]
                        }
                    }
                }
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },

        {
            $addFields: {
                totalVideos: {
                    $size: "$videos"
                },

                totalViews: {
                    $sum: "$videos.views"
                },

                owner: {
                    $arrayElemAt: [
                        "$owner",
                        0
                    ]
                }
            }
        },

        {
            $project: {
                _id: 1,
                name: 1,
                description: 1,
                createdAt: 1,
                updatedAt: 1,

                totalVideos: 1,
                totalViews: 1,

                videos: {
                    _id: 1,
                    videoFile: 1,
                    thumbnail: 1,
                    title: 1,
                    description: 1,
                    duration: 1,
                    views: 1,
                    createdAt: 1
                },

                owner: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1
                }
            }
        }
    ]);

    if (!playlist.length) {
        throw new ApiError(404, "Playlist not found");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            "Playlist fetched successfully",
            playlist[0]
        )
    );
});


const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    if (
        !mongoose.isValidObjectId(playlistId) ||
        !mongoose.isValidObjectId(videoId)
    ) {
        throw new ApiError(
            400,
            "Invalid playlist ID or video ID"
        );
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    /*
     * A user can only add videos to their own playlist.
     *
     * We intentionally do NOT require the video owner to be
     * the playlist owner. A playlist owner should be able to
     * curate videos created by other users.
     */
    if (
        playlist.owner.toString() !==
        req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to modify this playlist"
        );
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $addToSet: {
                videos: videoId
            }
        },
        {
            new: true,
            runValidators: true
        }
    );

    if (!updatedPlaylist) {
        throw new ApiError(
            500,
            "Failed to add video to playlist"
        );
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            "Video added to playlist successfully",
            updatedPlaylist
        )
    );
});


const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    if (
        !mongoose.isValidObjectId(playlistId) ||
        !mongoose.isValidObjectId(videoId)
    ) {
        throw new ApiError(
            400,
            "Invalid playlist ID or video ID"
        );
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    /*
     * Only the playlist owner can remove videos.
     */
    if (
        playlist.owner.toString() !==
        req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to modify this playlist"
        );
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull: {
                videos: videoId
            }
        },
        {
            new: true
        }
    );

    if (!updatedPlaylist) {
        throw new ApiError(
            500,
            "Failed to remove video from playlist"
        );
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            "Video removed from playlist successfully",
            updatedPlaylist
        )
    );
});


const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    if (!mongoose.isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (
        playlist.owner.toString() !==
        req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to delete this playlist"
        );
    }

    await Playlist.findByIdAndDelete(playlistId);

    return res.status(200).json(
        new ApiResponse(
            200,
            "Playlist deleted successfully",
            { playlistId }
        )
    );
});


const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { name, description } = req.body;

    if (!mongoose.isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    if (
        typeof name !== "string" ||
        !name.trim()
    ) {
        throw new ApiError(400, "Playlist name is required");
    }

    if (
        typeof description !== "string" ||
        !description.trim()
    ) {
        throw new ApiError(
            400,
            "Playlist description is required"
        );
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (
        playlist.owner.toString() !==
        req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to edit this playlist"
        );
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                name: name.trim(),
                description: description.trim()
            }
        },
        {
            new: true,
            runValidators: true
        }
    );

    if (!updatedPlaylist) {
        throw new ApiError(
            500,
            "Failed to update playlist"
        );
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            "Playlist updated successfully",
            updatedPlaylist
        )
    );
});


export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
};