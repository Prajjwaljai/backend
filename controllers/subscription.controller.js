import mongoose from "mongoose";

import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


/*
 * Subscribe / unsubscribe from a channel
 *
 * POST /api/v1/subscriptions/c/:channelId
 */
const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const subscriberId = req.user?._id;

    if (!mongoose.isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    if (!subscriberId) {
        throw new ApiError(401, "Unauthorized request");
    }

    /*
     * Prevent a user from subscribing to their own channel.
     */
    if (
        subscriberId.toString() ===
        channelId.toString()
    ) {
        throw new ApiError(
            400,
            "You cannot subscribe to your own channel"
        );
    }

    /*
     * Make sure the target channel actually exists.
     */
    const channelExists = await User.exists({
        _id: channelId
    });

    if (!channelExists) {
        throw new ApiError(404, "Channel not found");
    }

    /*
     * Check whether the current user has already
     * subscribed to this channel.
     */
    const existingSubscription = await Subscription.findOne({
        subscriber: subscriberId,
        channel: channelId
    });

    /*
     * Existing subscription → unsubscribe.
     */
    if (existingSubscription) {
        await Subscription.findByIdAndDelete(
            existingSubscription._id
        );

        return res.status(200).json(
            new ApiResponse(
                200,
                "Unsubscribed successfully",
                {
                    subscribed: false
                }
            )
        );
    }

    /*
     * No subscription → subscribe.
     */
    const subscription = await Subscription.create({
        subscriber: subscriberId,
        channel: channelId
    });

    if (!subscription) {
        throw new ApiError(
            500,
            "Failed to subscribe to channel"
        );
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            "Subscribed successfully", 
            {
                subscribed: true
            },
        )
    );
});


/*
 * Get all subscribers of a channel
 *
 * GET /api/v1/subscriptions/c/:channelId
 */
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!mongoose.isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const channelExists = await User.exists({
        _id: channelId
    });

    if (!channelExists) {
        throw new ApiError(404, "Channel not found");
    }

    const channelObjectId =
        new mongoose.Types.ObjectId(channelId);

    const currentUserId =
        new mongoose.Types.ObjectId(req.user._id);

    const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: channelObjectId
            }
        },

        /*
         * Get subscriber's user profile.
         */
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber"
            }
        },

        {
            $unwind: "$subscriber"
        },

        /*
         * Find all channels that this subscriber
         * has subscribed to.
         *
         * This allows us to determine whether the
         * subscriber also subscribes to the current
         * channel owner.
         */
        {
            $lookup: {
                from: "subscriptions",
                let: {
                    subscriberId: "$subscriber._id"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: [
                                    "$subscriber",
                                    "$$subscriberId"
                                ]
                            }
                        }
                    }
                ],
                as: "subscriberSubscriptions"
            }
        },

        /*
         * Get the subscriber's total subscriber count.
         */
        {
            $lookup: {
                from: "subscriptions",
                localField: "subscriber._id",
                foreignField: "channel",
                as: "subscriberFollowers"
            }
        },

        {
            $addFields: {
                subscribedToChannel: {
                    $in: [
                        channelObjectId,
                        "$subscriberSubscriptions.channel"
                    ]
                },

                subscribersCount: {
                    $size: "$subscriberFollowers"
                }
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

                subscriber: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1
                },

                subscribedToChannel: 1,
                subscribersCount: 1
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            "Subscribers fetched successfully",
            subscribers
        )
    );
});


/*
 * Get all channels that a user has subscribed to
 *
 * GET /api/v1/subscriptions/u/:subscriberId
 */
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    if (!mongoose.isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID");
    }

    const subscriberExists = await User.exists({
        _id: subscriberId
    });

    if (!subscriberExists) {
        throw new ApiError(404, "User not found");
    }

    const subscriberObjectId =
        new mongoose.Types.ObjectId(subscriberId);

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: subscriberObjectId
            }
        },

        /*
         * Get the channel's user profile.
         */
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "subscribedChannel"
            }
        },

        {
            $unwind: "$subscribedChannel"
        },

        /*
         * Get the latest published video from
         * each subscribed channel.
         */
        {
            $lookup: {
                from: "videos",
                let: {
                    channelId: "$subscribedChannel._id"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            "$owner",
                                            "$$channelId"
                                        ]
                                    },
                                    {
                                        $eq: [
                                            "$isPublished",
                                            true
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    {
                        $sort: {
                            createdAt: -1
                        }
                    },
                    {
                        $limit: 1
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
                            createdAt: 1,
                            owner: 1
                        }
                    }
                ],
                as: "latestVideo"
            }
        },

        {
            $lookup: {
                from: "subscriptions",
                localField: "subscribedChannel._id",
                foreignField: "channel",
                as: "channelSubscribers"
            }
        },

        {
            $addFields: {
                latestVideo: {
                    $arrayElemAt: [
                        "$latestVideo",
                        0
                    ]
                },

                subscribersCount: {
                    $size: "$channelSubscribers"
                }
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

                subscribedChannel: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                    coverImage: 1
                },

                subscribersCount: 1,

                latestVideo: 1
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            "Subscribed channels fetched successfully",
            subscribedChannels
        )
    );
});


export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
};