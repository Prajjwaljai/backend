import mongoose from "mongoose";

import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Tweet } from "../models/tweet.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.exists({
        _id: videoId
    });

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const existingLike = await Like.findOne({
        videos: videoId,
        likedBy: req.user._id
    });

    if (existingLike) {
        await Like.findByIdAndDelete(existingLike._id);

        return res.status(200).json(
            new ApiResponse(
                200,
                "Video unliked successfully",
                { isLiked: false }
            )
        );
    }

    await Like.create({
        videos: videoId,
        likedBy: req.user._id
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            "Video liked successfully",
            { isLiked: true }
        )
    );
});


const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    const comment = await Comment.exists({
        _id: commentId
    });

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    const existingLike = await Like.findOne({
        comments: commentId,
        likedBy: req.user._id
    });

    if (existingLike) {
        await Like.findByIdAndDelete(existingLike._id);

        return res.status(200).json(
            new ApiResponse(
                200,
                "Comment unliked successfully",
                { isLiked: false }
            )
        );
    }

    await Like.create({
        comments: commentId,
        likedBy: req.user._id
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            "Comment liked successfully",
            { isLiked: true }
        )
    );
});


const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    const tweet = await Tweet.exists({
        _id: tweetId
    });

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    const existingLike = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user._id
    });

    if (existingLike) {
        await Like.findByIdAndDelete(existingLike._id);

        return res.status(200).json(
            new ApiResponse(
                200,
                "Tweet unliked successfully",
                { isLiked: false }
            )
        );
    }

    await Like.create({
    tweet: tweetId,
    likedBy: req.user._id
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            "Tweet liked successfully",
            { isLiked: true }
        )
    );
});


const getLikedVideos = asyncHandler(async (req, res) => {
    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user._id),

                /*
                 * Only likes that actually belong to videos.
                 */
                videos: {
                    $exists: true,
                    $ne: null
                }
            }
        },

        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "likedVideo"
            }
        },

        {
            $unwind: {
                path: "$likedVideo",
                preserveNullAndEmptyArrays: false
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "likedVideo.owner",
                foreignField: "_id",
                as: "owner"
            }
        },

        {
            $unwind: {
                path: "$owner",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $sort: {
                createdAt: -1
            }
        },

        {
            $project: {
                _id: 0,

                likedVideo: {
                    _id: "$likedVideo._id",
                    videoFile: "$likedVideo.videoFile",
                    thumbnail: "$likedVideo.thumbnail",
                    title: "$likedVideo.title",
                    description: "$likedVideo.description",
                    duration: "$likedVideo.duration",
                    views: "$likedVideo.views",
                    isPublished: "$likedVideo.isPublished",
                    createdAt: "$likedVideo.createdAt",

                    owner: {
                        _id: "$owner._id",
                        username: "$owner.username",
                        fullName: "$owner.fullName",
                        avatar: "$owner.avatar"
                    }
                }
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            "Liked videos fetched successfully",
            likedVideos
        )
    );
});


export {
    toggleVideoLike,
    toggleCommentLike,
    toggleTweetLike,
    getLikedVideos
};