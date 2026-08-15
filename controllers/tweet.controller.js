import mongoose from "mongoose";

import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


/*
 * Create a new tweet
 *
 * POST /api/v1/tweets/
 */
const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;

    if (
        typeof content !== "string" ||
        !content.trim()
    ) {
        throw new ApiError(
            400,
            "Tweet content is required"
        );
    }

    const tweet = await Tweet.create({
        content: content.trim(),
        owner: req.user._id
    });

    if (!tweet) {
        throw new ApiError(
            500,
            "Failed to create tweet. Please try again"
        );
    }

    const createdTweet = await Tweet.findById(tweet._id)
        .populate(
            "owner",
            "_id username fullName avatar"
        );

    return res.status(201).json(
        new ApiResponse(
            201,
            "Tweet created successfully",
            createdTweet
        )
    );
});


/*
 * Get all tweets created by a user
 *
 * GET /api/v1/tweets/user/:userId
 */
const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(
            400,
            "Invalid user ID"
        );
    }

    /*
     * Make sure the requested user exists.
     */
    const userExists = await User.exists({
        _id: userId
    });

    if (!userExists) {
        throw new ApiError(
            404,
            "User not found"
        );
    }

    const userObjectId =
        new mongoose.Types.ObjectId(userId);

    const currentUserObjectId =
        new mongoose.Types.ObjectId(req.user._id);

    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: userObjectId
            }
        },

        /*
         * Get tweet owner's public profile.
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
         * Get likes belonging to this tweet.
         *
         * Your Like schema uses `tweet`.
         */
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likeDetails"
            }
        },

        {
            $addFields: {
                likesCount: {
                    $size: "$likeDetails"
                },

                /*
                 * Determine whether the currently
                 * authenticated user liked this tweet.
                 */
                isLiked: {
                    $in: [
                        currentUserObjectId,
                        "$likeDetails.likedBy"
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
            $project: {
                _id: 1,
                content: 1,
                createdAt: 1,
                updatedAt: 1,

                likesCount: 1,
                isLiked: 1,

                ownerDetails: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1
                }
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            "Tweets fetched successfully",
            tweets
        )
    );
});


/*
 * Update a tweet
 *
 * PATCH /api/v1/tweets/:tweetId
 */
const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { content } = req.body;

    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(
            400,
            "Invalid tweet ID"
        );
    }

    if (
        typeof content !== "string" ||
        !content.trim()
    ) {
        throw new ApiError(
            400,
            "Tweet content is required"
        );
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(
            404,
            "Tweet not found"
        );
    }

    /*
     * Only the tweet owner can edit it.
     */
    if (
        tweet.owner.toString() !==
        req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to edit this tweet"
        );
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content: content.trim()
            }
        },
        {
            new: true,
            runValidators: true
        }
    ).populate(
        "owner",
        "_id username fullName avatar"
    );

    if (!updatedTweet) {
        throw new ApiError(
            500,
            "Failed to update tweet. Please try again"
        );
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            "Tweet updated successfully",
            updatedTweet
        )
    );
});


/*
 * Delete a tweet
 *
 * DELETE /api/v1/tweets/:tweetId
 */
const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(
            400,
            "Invalid tweet ID"
        );
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(
            404,
            "Tweet not found"
        );
    }

    /*
     * Only the tweet owner can delete it.
     */
    if (
        tweet.owner.toString() !==
        req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to delete this tweet"
        );
    }

    await Tweet.findByIdAndDelete(tweetId);

    /*
     * Remove likes associated with the deleted tweet.
     *
     * This prevents orphaned Like documents.
     */
    await Like.deleteMany({
        tweet: tweetId
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            "Tweet deleted successfully",
            { tweetId },
        )
    );
});


export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
};