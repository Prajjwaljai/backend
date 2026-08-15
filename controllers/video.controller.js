import mongoose from "mongoose";

import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";

import { uploadImage } from "../utils/cloudinary.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


/*
 * Get all published videos
 *
 * Supports:
 * ?page=1
 * ?limit=10
 * ?query=javascript
 * ?sortBy=views
 * ?sortType=asc
 * ?userId=...
 */
const getAllVideos = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        query,
        sortBy,
        sortType,
        userId
    } = req.query;

    const currentPage = Math.max(
        Number.parseInt(page, 10) || 1,
        1
    );

    const pageLimit = Math.min(
        Math.max(
            Number.parseInt(limit, 10) || 10,
            1
        ),
        100
    );

    const pipeline = [];

    /*
     * We deliberately don't use MongoDB Atlas $search here.
     *
     * Your current project does not establish a search index,
     * so using $search would make the endpoint dependent on
     * an external Atlas configuration.
     *
     * For now, use case-insensitive regex search.
     */
    if (query?.trim()) {
        const searchRegex = {
            $regex: query.trim(),
            $options: "i"
        };

        pipeline.push({
            $match: {
                isPublished: true,
                $or: [
                    {
                        title: searchRegex
                    },
                    {
                        description: searchRegex
                    }
                ]
            }
        });
    } else {
        pipeline.push({
            $match: {
                isPublished: true
            }
        });
    }

    /*
     * Filter videos belonging to a particular user.
     */
    if (userId) {
        if (!mongoose.isValidObjectId(userId)) {
            throw new ApiError(
                400,
                "Invalid user ID"
            );
        }

        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    /*
     * Whitelist sortable fields.
     *
     * Never directly trust a query parameter as a MongoDB
     * field name in production code.
     */
    const allowedSortFields = [
        "views",
        "createdAt",
        "duration",
        "title"
    ];

    const selectedSortField =
        allowedSortFields.includes(sortBy)
            ? sortBy
            : "createdAt";

    const selectedSortDirection =
        sortType === "asc"
            ? 1
            : -1;

    pipeline.push({
        $sort: {
            [selectedSortField]: selectedSortDirection
        }
    });

    /*
     * Get public owner information.
     */
    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails"
            }
        },

        {
            $unwind: "$ownerDetails"
        },

        {
            $project: {
                _id: 1,
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1,

                owner: {
                    _id: "$ownerDetails._id",
                    username: "$ownerDetails.username",
                    fullName: "$ownerDetails.fullName",
                    avatar: "$ownerDetails.avatar"
                }
            }
        }
    );

    const videoAggregate = Video.aggregate(
        pipeline
    );

    const videos = await Video.aggregatePaginate(
        videoAggregate,
        {
            page: currentPage,
            limit: pageLimit
        }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            "Videos fetched successfully",
            videos
        )
    );
});


/*
 * Upload and publish a video
 *
 * POST /
 *
 * multipart/form-data:
 * videoFile
 * thumbnail
 * title
 * description
 */
const publishAVideo = asyncHandler(async (req, res) => {
    const {
        title,
        description
    } = req.body;

    if (
        typeof title !== "string" ||
        !title.trim()
    ) {
        throw new ApiError(
            400,
            "Video title is required"
        );
    }

    if (
        typeof description !== "string" ||
        !description.trim()
    ) {
        throw new ApiError(
            400,
            "Video description is required"
        );
    }

    /*
     * upload.fields() puts files inside req.files:
     *
     * req.files.videoFile[0]
     * req.files.thumbnail[0]
     */
    const videoFileLocalPath =
        req.files?.videoFile?.[0]?.path;

    const thumbnailLocalPath =
        req.files?.thumbnail?.[0]?.path;

    if (!videoFileLocalPath) {
        throw new ApiError(
            400,
            "Video file is required"
        );
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(
            400,
            "Thumbnail is required"
        );
    }

    /*
     * Upload video and thumbnail.
     *
     * Your current Cloudinary utility uses
     * resource_type: "auto", so it can handle both.
     */
    const videoFile = await uploadImage(
        videoFileLocalPath
    );

    const thumbnail = await uploadImage(
        thumbnailLocalPath
    );

    if (!videoFile) {
        throw new ApiError(
            500,
            "Video upload failed"
        );
    }

    if (!thumbnail) {
        throw new ApiError(
            500,
            "Thumbnail upload failed"
        );
    }

    /*
     * Cloudinary normally returns duration for video uploads.
     */
    if (
        typeof videoFile.duration !== "number"
    ) {
        throw new ApiError(
            500,
            "Unable to determine video duration"
        );
    }

    const video = await Video.create({
        videoFile: videoFile.secure_url,
        thumbnail: thumbnail.secure_url,
        title: title.trim(),
        description: description.trim(),
        duration: videoFile.duration,
        owner: req.user._id,
        isPublished: true
    });

    if (!video) {
        throw new ApiError(
            500,
            "Failed to create video"
        );
    }

    return res.status(201).json(
        new ApiResponse(
            201,
            "Video uploaded successfully",
            video
        )
    );
});


/*
 * Get a single video
 *
 * GET /v/:videoId
 */
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(
            400,
            "Invalid video ID"
        );
    }

    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(
            401,
            "Unauthorized request"
        );
    }

    /*
     * Get video information and owner information.
     */
    const videoResult = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(
                    videoId
                )
            }
        },

        /*
         * Likes for this video.
         *
         * Your Like schema uses `videos`.
         */
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "videos",
                as: "likes"
            }
        },

        /*
         * Get video owner.
         */
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails"
            }
        },

        {
            $unwind: "$ownerDetails"
        },

        /*
         * Get subscribers of this channel.
         */
        {
            $lookup: {
                from: "subscriptions",
                localField: "ownerDetails._id",
                foreignField: "channel",
                as: "channelSubscribers"
            }
        },

        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },

                isLiked: {
                    $in: [
                        new mongoose.Types.ObjectId(
                            userId
                        ),
                        "$likes.likedBy"
                    ]
                },

                subscribersCount: {
                    $size: "$channelSubscribers"
                },

                isSubscribed: {
                    $in: [
                        new mongoose.Types.ObjectId(
                            userId
                        ),
                        "$channelSubscribers.subscriber"
                    ]
                }
            }
        },

        {
            $project: {
                _id: 1,
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1,

                likesCount: 1,
                isLiked: 1,

                owner: {
                    _id: "$ownerDetails._id",
                    username: "$ownerDetails.username",
                    fullName: "$ownerDetails.fullName",
                    avatar: "$ownerDetails.avatar",
                    subscribersCount: "$subscribersCount",
                    isSubscribed: "$isSubscribed"
                }
            }
        }
    ]);

    if (!videoResult.length) {
        throw new ApiError(
            404,
            "Video not found"
        );
    }

    const video = videoResult[0];

    /*
     * Increment views only after successfully
     * finding the video.
     */
    await Video.findByIdAndUpdate(
        videoId,
        {
            $inc: {
                views: 1
            }
        }
    );

    /*
     * Add video to watch history.
     *
     * $addToSet prevents duplicate entries.
     */
    await User.findByIdAndUpdate(
        userId,
        {
            $addToSet: {
                watchHistory: videoId
            }
        }
    );

    /*
     * Return the incremented view count as well.
     */
    video.views += 1;

    return res.status(200).json(
        new ApiResponse(
            200,
            "Video details fetched successfully",
            video
        )
    );
});


/*
 * Update title, description and thumbnail
 *
 * PATCH /v/:videoId
 */
const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const {
        title,
        description
    } = req.body;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(
            400,
            "Invalid video ID"
        );
    }

    if (
        typeof title !== "string" ||
        !title.trim()
    ) {
        throw new ApiError(
            400,
            "Video title is required"
        );
    }

    if (
        typeof description !== "string" ||
        !description.trim()
    ) {
        throw new ApiError(
            400,
            "Video description is required"
        );
    }

    const video = await Video.findById(
        videoId
    );

    if (!video) {
        throw new ApiError(
            404,
            "Video not found"
        );
    }

    /*
     * Only the video owner can update it.
     */
    if (
        video.owner.toString() !==
        req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to update this video"
        );
    }

    const thumbnailLocalPath =
        req.file?.path;

    /*
     * Thumbnail is required because the route uses
     * upload.single("thumbnail") and this endpoint is
     * intended to replace it.
     */
    if (!thumbnailLocalPath) {
        throw new ApiError(
            400,
            "Thumbnail is required"
        );
    }

    const thumbnail = await uploadImage(
        thumbnailLocalPath
    );

    if (!thumbnail) {
        throw new ApiError(
            500,
            "Thumbnail upload failed"
        );
    }

    const updatedVideo =
        await Video.findByIdAndUpdate(
            videoId,
            {
                $set: {
                    title: title.trim(),
                    description: description.trim(),
                    thumbnail: thumbnail.secure_url
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

    if (!updatedVideo) {
        throw new ApiError(
            500,
            "Failed to update video"
        );
    }

    /*
     * We intentionally do not delete the old Cloudinary
     * thumbnail here because your current cloudinary.js
     * does not yet expose a deletion helper.
     *
     * We'll add proper Cloudinary asset cleanup when
     * we improve that utility.
     */

    return res.status(200).json(
        new ApiResponse(
            200,
            "Video updated successfully",
            updatedVideo
        )
    );
});


/*
 * Delete a video
 *
 * DELETE /v/:videoId
 */
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(
            400,
            "Invalid video ID"
        );
    }

    const video = await Video.findById(
        videoId
    );

    if (!video) {
        throw new ApiError(
            404,
            "Video not found"
        );
    }

    if (
        video.owner.toString() !==
        req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to delete this video"
        );
    }

    /*
     * Delete the video itself.
     */
    await Video.findByIdAndDelete(
        videoId
    );

    /*
     * Remove associated likes.
     *
     * Your Like schema uses `videos`.
     */
    await Like.deleteMany({
        videos: videoId
    });

    /*
     * Remove associated comments.
     *
     * Your Comment schema uses `videos`.
     */
    const deletedComments =
        await Comment.find({
            videos: videoId
        }).select("_id");

    const commentIds =
        deletedComments.map(
            (comment) => comment._id
        );

    if (commentIds.length) {
        await Like.deleteMany({
            comments: {
                $in: commentIds
            }
        });

        await Comment.deleteMany({
            videos: videoId
        });
    }

    /*
     * Remove the video from every playlist that
     * contains it.
     */
    await mongoose.connection
        .collection("playlists")
        .updateMany(
            {
                videos: videoId
            },
            {
                $pull: {
                    videos: videoId
                }
            }
        );

    /*
     * Remove the video from users' watch histories.
     */
    await User.updateMany(
        {
            watchHistory: videoId
        },
        {
            $pull: {
                watchHistory: videoId
            }
        }
    );

    /*
     * Cloudinary cleanup will be added once the
     * Cloudinary utility exposes a proper delete helper.
     */

    return res.status(200).json(
        new ApiResponse(
            200,
            "Video deleted successfully",
            { videoId }
        )
    );
});


/*
 * Toggle video publish status
 *
 * PATCH /toggle/publish/:videoId
 */
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(
            400,
            "Invalid video ID"
        );
    }

    const video = await Video.findById(
        videoId
    );

    if (!video) {
        throw new ApiError(
            404,
            "Video not found"
        );
    }

    if (
        video.owner.toString() !==
        req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to change this video's publish status"
        );
    }

    const updatedVideo =
        await Video.findByIdAndUpdate(
            videoId,
            {
                $set: {
                    isPublished:
                        !video.isPublished
                }
            },
            {
                new: true,
                runValidators: true
            }
        ).select(
            "_id title isPublished updatedAt"
        );

    if (!updatedVideo) {
        throw new ApiError(
            500,
            "Failed to toggle video publish status"
        );
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            "Video publish status toggled successfully",
            {
                videoId: updatedVideo._id,
                isPublished:
                    updatedVideo.isPublished
            },
        )
    );
});


export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
};