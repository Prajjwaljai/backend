import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadImage = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    
    // Fix: Use the imported 'cloudinary' reference directly
    const result = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    
    // Clean up the local file after a successful upload
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    
    console.log("Image uploaded to Cloudinary:", result.secure_url);
    return result;
  } catch (error) {
    console.error("Error uploading image to Cloudinary:", error);
    
    // Fix: Delete the local file BEFORE throwing the error
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    
    throw new Error("Image upload failed");
  }
}

export { uploadImage };
