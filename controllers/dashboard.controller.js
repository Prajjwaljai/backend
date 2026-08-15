import mongoose from "mongoose";

import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


const getChannelStats = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId || !mongoose.isValidObjectId(userId)) {
        throw new ApiError(401, "Unauthorized request");
    }

    const objectId = new mongoose.Types.ObjectId(userId);

    /*
     * Get subscriber count.
     *
     * A subscription document represents:
     * subscriber -> user who subscribed
     * channel    -> user whose channel was subscribed to
     */
    const subscriberStats = await Subscription.aggregate([
        {
            $match: {
                channel: objectId
            }
        },
        {
            $count: "totalSubscribers"
        }
    ]);

    /*
     * Get video-related statistics for this channel.
     *
     * Each video contains:
     * - views
     * - owner
     *
     * Likes are stored separately in the Like collection.
     * Your current Like model uses `videos` as the reference field.
     */
    const videoStats = await Video.aggregate([
        {
            $match: {
                owner: objectId
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "videos",
                as: "videoLikes"
            }
        },
        {
            $group: {
                _id: null,

                totalVideos: {
                    $sum: 1
                },

                totalViews: {
                    $sum: "$views"
                },

                totalLikes: {
                    $sum: {
                        $size: "$videoLikes"
                    }
                }
            }
        }
    ]);

    const stats = videoStats[0];

    const channelStats = {
        totalSubscribers:
            subscriberStats[0]?.totalSubscribers || 0,

        totalVideos:
            stats?.totalVideos || 0,

        totalViews:
            stats?.totalViews || 0,

        totalLikes:
            stats?.totalLikes || 0
    };

    return res.status(200).json(
        new ApiResponse(
            200,
            "Channel stats fetched successfully",
            channelStats
        )
    );
});


const getChannelVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId || !mongoose.isValidObjectId(userId)) {
        throw new ApiError(401, "Unauthorized request");
    }

    const objectId = new mongoose.Types.ObjectId(userId);

    const videos = await Video.aggregate([
        {
            $match: {
                owner: objectId
            }
        },

        /*
         * Get likes belonging to each video.
         *
         * IMPORTANT:
         * Your Like schema uses `videos`, not `video`.
         */
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "videos",
                as: "videoLikes"
            }
        },

        {
            $addFields: {
                likesCount: {
                    $size: "$videoLikes"
                }
            }
        },

        /*
         * Latest uploaded videos first.
         */
        {
            $sort: {
                createdAt: -1
            }
        },

        /*
         * Return only the information required
         * for the channel dashboard.
         *
         * Your current Video model stores these
         * as strings, unlike the reference project.
         */
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
                likesCount: 1
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            "Channel videos fetched successfully",
            videos
        )
    );
});


export {
    getChannelStats,
    getChannelVideos
};