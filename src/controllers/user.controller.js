import User from '../models/user.model.js'
import { deleteFromCloudinary, uploadOnCloudinary } from '../utils/cloudinary.js';

/**
 * Get Customer Controller 
 * API - [/api/customer/getCustomer]
 */

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        error: "User Not Found"
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ err: `Get current user error ${error}` });
  }
};

export const updateUserLocation = async (req, res) => {
  try {
    const { lat, long } = req.body;

    const user = await User.findByIdAndUpdate(req.userId, {
      location: {
        type: "Point",
        coordinates: [long, lat]
      }
    })

    if (!user) {
      return res.status(404).json({
        error: "User Not Found"
      });
    }

    return res.status(200).json({
      mesaage: "Location Updated"
    });
  } catch (error) {
   
    return res.status(500).json({ err: `update user location error ${error}` });
  }
}


export const editUserProfile = async (req, res) => {
  try {
    const { fullname, email, phone } = req.body;
    let profileImage;

    let user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ err: "User not found" });
    }

    if (req.file) {
      if (user?.profileImage?.public_id) {
        await deleteFromCloudinary(user.profileImage.public_id, "profileImage");
      }

      const result = await uploadOnCloudinary(req.file.path, "profileImage");
      profileImage = { url: result.secure_url, public_id: result.public_id };
    }

    user = await User.findByIdAndUpdate(
      req.userId,
      {
        fullname,
        email,
        phone,
        profileImage: profileImage ?? user.profileImage,
      },
      { returnDocument: "after" }
    );

    return res.status(200).json(user);
  } catch (error) {
    (error);
    
    return res.status(500).json({
      err: `Edit user profile error ${error}`
    });
  }
};
