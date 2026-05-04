import Shop from "../models/shop.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";



export const createAndEditShop = async (req, res) => {
  try {
    const { restaurantName, city, state, address } = req.body;
    let image;

    let shop = await Shop.findOne({ owner: req.userId });

    console.log(req.file);
    

    if (req.file) {
      if (shop?.image?.public_id) {
        await deleteFromCloudinary(shop.image.public_id, "image");
      }

      const result = await uploadOnCloudinary(req.file.buffer, "shopImage");
      image = { url: result.secure_url, public_id: result.public_id };
    }

    if (!shop) {
      shop = await Shop.create({
        restaurantName, city, state, image, address,
        owner: req.userId
      })
    } else {
      shop = await Shop.findByIdAndUpdate(
        shop._id,
        { restaurantName, city, state, image: image ?? shop.image, address },
        { returnDocument: "after" }
      );
    }

    await shop.populate("owner foodItems")
    return res.status(201).json(shop);
  } catch (error) {
    console.log(error);
    
    return res.status(500).json({
      err: `Create shop error ${error}`
    })
  }
}

export const getMyShop = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.userId }).populate("owner").populate({
        path: "foodItems",
        options:{sort:{updatedAt:-1}}
    });

    if (!shop) {
      return null
    }

    return res.status(200).json(shop);

  } catch (error) {
    return res.status(500).json({
      err: `Get shop error ${error}`
    })
  }
}


export const getShopByCity =async (req, res) => {
  try {
    const {city} = req.params;

    const shop = await Shop.find({
      city:{$regex:new RegExp(`^${city}$`, "i")}
    }).populate("foodItems")

    if(!shop){
      return res.status(400).json({
        error:"Shop not found"
      })
    }
    return res.status(200).json(shop)
  } catch (error) {
    return res.status(500).json({
      err: `Get shop by city error ${error}`
    })
  }
}
