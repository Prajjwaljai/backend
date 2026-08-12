import mongoose, {Schema} from "mongoose";


const likeSchema = new Schema(
    {
        videos: {
            type: Schema.Types.ObjectId,
            ref: "Video",
            required: true
        },
        comments: {
            type: Schema.Types.ObjectId,
            ref: "Comment"
        },
        tweet:{
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

export const Like = mongoose.model("Like", likeSchema);