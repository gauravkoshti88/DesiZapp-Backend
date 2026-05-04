import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload using buffer (memoryStorage)
export const uploadOnCloudinary = (fileBuffer, folder = "uploads", resourceType = "auto") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(fileBuffer); 
  });
};

export const deleteFromCloudinary = async (public_id, type = "image") => {
  try {
    const options = {};
    if (type === "video") options.resource_type = "video";
    if (type === "raw") options.resource_type = "raw";

    return await cloudinary.uploader.destroy(public_id, options);
  } catch (error) {
    return null;
  }
};

export default cloudinary;
