import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import {User} from '../models/user.model.js';
import {uploadImage} from '../utils/cloudinary.js';
import {ApiResponse} from '../utils/ApiResponse.js';


const generateAccessAndRefreshToken = async (userId) => {
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});
        return {accessToken, refreshToken};
    }catch(error){
        throw new ApiError(500, "Error while generating access and refresh token");
    }
}

const registerUser = asyncHandler(async (req, res) => {
    const {fullName, email, username,password} = req.body;
    if([fullName, email, username, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({$or: [{email}, {username}]});
    if (existedUser) {
        throw new ApiError(409, "User already exists with this email or username");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;
    //We can also check if coverImageLocalPath is provided.
    let coverImageLocalPath ;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath ) {
        throw new ApiError(400, "Avatar image is required");
    }

    const avatar = await uploadImage(avatarLocalPath);
    const coverImage = await uploadImage(coverImageLocalPath);

    if(!avatar) {
        throw new ApiError(400, "Error while uploading avatar");
    }

    const user = await User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if(!createdUser) {
        throw new ApiError(500, "Error while registering user");
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    );
});

const loginUser = asyncHandler(async(req, res)=>{
    //req bady->data
    //username or email
    //find user
    //password check
    //access and refresh token
    // send token in secure cookies
    //send response
    const {username,email, password} = req.body;
    if(!username && !email){
        throw new ApiError(400, "Username or email is required");
    }
    const user = await User.findOne({$or: [{username}, {email}]});
    if(!user){
        throw new ApiError(404, "User not found");
    }
    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(400, "Invalid user credentials");
    }
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    if(!loggedInUser){
        throw new ApiError(500, "Error while logging in user");
    }

    const options = {
        httpOnly: true,
        secure: true
    };

    return res.status(200).cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, {user: loggedInUser, accessToken, refreshToken}, "User logged in successfully")
    )

});

const logoutUser = asyncHandler(async(req, res)=>{
    //clear cookies
    //invalidate refresh token in db
    //send response
    await User.findByIdAndUpdate(req.user._id, 
        {
            $set:{refreshToken: undefined}
        },
        {
            new: true,
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    };
    return res.status(200).clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged out successfully")
    )
})


export {registerUser, loginUser, logoutUser};