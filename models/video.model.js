import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";//mongo db plugins to create aggregation pipelines


const videoSchema = new Schema({
    videoFile:{
        type: String, //cloudinary url
        required: true,
    },
    thumbnail:{
        type: String, //cloudinary url
        required: true,
    },
    title:{
        type: String,
        required: true,
    },
    description:{
        type: String,
        required: true,
    },
    duration:{
        type: Number, //cloudinary 
        required: true,
    },
    views:{
        type: Number,
        default: 0
    },
    isPublished:{
        type: Boolean,
        default:true
    },
    owner:{
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
},
{
    timestamps: true,
}
)

videoSchema.plugin(mongooseAggregatePaginate);// There were many plugins available for mongoose, but this one is used to create aggregation pipelines for the video model. It allows us to perform complex queries and aggregations on the video collection in MongoDB. 

export const Video = mongoose.model("Video", videoSchema);