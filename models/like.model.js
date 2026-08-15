import mongoose, { Schema } from "mongoose";


const likeSchema = new Schema(
    {
        videos: {
            type: Schema.Types.ObjectId,
            ref: "Video"
        },

        comments: {
            type: Schema.Types.ObjectId,
            ref: "Comment"
        },

        tweet: {
            type: Schema.Types.ObjectId,
            ref: "Tweet"
        },

        likedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);


// A Like must belong to exactly one target.
likeSchema.pre("validate", function () {
    const targetCount = [
        this.videos,
        this.comments,
        this.tweet
    ].filter(Boolean).length;

    if (targetCount !== 1) {
        throw new Error(
            "A like must belong to exactly one video, comment, or tweet"
        );
    }
});


// Prevent the same user from liking the same video more than once.
likeSchema.index(
    { videos: 1, likedBy: 1 },
    {
        unique: true,
        partialFilterExpression: {
            videos: { $exists: true }
        }
    }
);


// Prevent the same user from liking the same comment more than once.
likeSchema.index(
    { comments: 1, likedBy: 1 },
    {
        unique: true,
        partialFilterExpression: {
            comments: { $exists: true }
        }
    }
);


// Prevent the same user from liking the same tweet more than once.
likeSchema.index(
    { tweet: 1, likedBy: 1 },
    {
        unique: true,
        partialFilterExpression: {
            tweet: { $exists: true }
        }
    }
);


export const Like = mongoose.model("Like", likeSchema);