import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'
import path from "path";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloudinary = async (filePath, folder="public", resourceType = "auto") => {

    try {
        const normalizedPath = path.resolve(filePath);

        const result = await cloudinary.uploader.upload(normalizedPath, {
            folder: folder,
            resource_type: resourceType
        })

        if (fs.existsSync(normalizedPath)) {
            fs.unlinkSync(normalizedPath);
        }

        return result;
    } catch (error) {
        fs.unlinkSync(filePath);
        return null;
    }
}

export const deleteFromCloudinary = async (public_id, type = "image") => {
    try {
        const options = {};
        if (type === "video") {
            options.resource_type = "video";
        } else if (type === "raw") {
            options.resource_type = "raw";
        }

        const result = await cloudinary.uploader.destroy(public_id, options);
    
        return result;
    } catch (error) {
        return null;
    }
};

export default cloudinary;

