// import { v2 as cloudinary } from 'cloudinary'
// import fs from 'fs'
// import path from "path";

// cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// export const uploadOnCloudinary = async (filePath, folder="public", resourceType = "auto") => {

//     try {
//         const normalizedPath = path.resolve(filePath);

//         const result = await cloudinary.uploader.upload(normalizedPath, {
//             folder: folder,
//             resource_type: resourceType
//         })

//         if (fs.existsSync(normalizedPath)) {
//             fs.unlinkSync(normalizedPath);
//         }

//         return result;
//     } catch (error) {
//         fs.unlinkSync(filePath);
//         return null;
//     }
// }

// export const deleteFromCloudinary = async (public_id, type = "image") => {
//     try {
//         const options = {};
//         if (type === "video") {
//             options.resource_type = "video";
//         } else if (type === "raw") {
//             options.resource_type = "raw";
//         }

//         const result = await cloudinary.uploader.destroy(public_id, options);
    
//         return result;
//     } catch (error) {
//         return null;
//     }
// };

// export default cloudinary;

import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloudinary = async (filePath, folder = "uploads", resourceType = "auto") => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: resourceType,
    });

    // ✅ delete local temp file safely
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return result;
  } catch (error) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return null;
  }
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
