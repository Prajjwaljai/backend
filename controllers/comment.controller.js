import mongoose from "mongoose";

import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


/*
 * Get all comments for a particular video
 *
 * Route:
 * GET /api/v1/comments/:videoId
 *
 * Query:
 * ?page=1&limit=10
 */
const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
        Math.max(Number.parseInt(req.query.limit, 10) || 10, 1),
        100
    );

    // Validate videoId before using it in MongoDB queries/aggregation
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // Make sure the requested video actually exists
    const video = await Video.exists({ _id: videoId });

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const commentsAggregate = Comment.aggregate([
        {
            $match: {
                videos: new mongoose.Types.ObjectId(videoId)
            }
        },

        // Get comment owner's information
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },

        // Get likes associated with each comment
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comments",
                as: "likes"
            }
        },

        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },

                owner: {
                    $arrayElemAt: ["$owner", 0]
                },

                isLiked: {
                    $in: [
                        req.user._id,
                        "$likes.likedBy"
                    ]
                }
            }
        },

        // Newest comments first
        {
            $sort: {
                createdAt: -1
            }
        },

        // Return only the fields needed by the client
        {
            $project: {
                content: 1,
                createdAt: 1,
                updatedAt: 1,

                likesCount: 1,
                isLiked: 1,

                owner: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1
                }
            }
        }
    ]);

    const comments = await Comment.aggregatePaginate(
        commentsAggregate,
        {
            page,
            limit
        }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            "Comments fetched successfully",
            comments
        )
    );
});


/*
 * Add a comment to a video
 *
 * Route:
 * POST /api/v1/comments/:videoId
 *
 * Body:
 * {
 *     "content": "This is a great video!"
 * }
 */
const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    if (
        typeof content !== "string" ||
        !content.trim()
    ) {
        throw new ApiError(400, "Comment content is required");
    }

    const video = await Video.exists({ _id: videoId });

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const comment = await Comment.create({
        content: content.trim(),
        videos: videoId,
        owner: req.user._id
    });

    if (!comment) {
        throw new ApiError(
            500,
            "Failed to add comment. Please try again"
        );
    }

    const createdComment = await Comment.findById(comment._id)
        .populate(
            "owner",
            "_id username fullName avatar"
        );

    return res.status(201).json(
        new ApiResponse(
            201,
            "Comment added successfully",
            createdComment
        )
    );
});


/*
 * Update an existing comment
 *
 * Route:
 * PATCH /api/v1/comments/c/:commentId
 *
 * Body:
 * {
 *     "content": "Updated comment"
 * }
 */
const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    if (
        typeof content !== "string" ||
        !content.trim()
    ) {
        throw new ApiError(400, "Comment content is required");
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    // Only the comment owner can edit it
    if (
        comment.owner.toString() !==
        req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to edit this comment"
        );
    }

    const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
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

    if (!updatedComment) {
        throw new ApiError(
            500,
            "Failed to update comment. Please try again"
        );
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            "Comment updated successfully",
            updatedComment
        )
    );
});


/*
 * Delete an existing comment
 *
 * Route:
 * DELETE /api/v1/comments/c/:commentId
 */
const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    // Only the comment owner can delete it
    if (
        comment.owner.toString() !==
        req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to delete this comment"
        );
    }

    await Comment.findByIdAndDelete(commentId);

    /*
     * Remove all likes belonging to the deleted comment.
     *
     * Your Like schema uses `comments`, not `comment`.
     */
    await Like.deleteMany({
        comments: commentId
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            "Comment deleted successfully",
            { commentId }
        )
    );
});


export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
};