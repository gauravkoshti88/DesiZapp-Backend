import Shop from "../models/shop.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js'
import Item from "../models/item.model.js";
import redisClient from "../config/redis.js";

/**
 * Add FoodItem Controller 
 * API - [/api/food/add-item]
 */

export const addItem = async (req, res) => {
  const { dishname, category, price, foodType } = req.body;

  try {
    let image;
    let video;

    if (req.files?.image?.[0]) {
      const result = await uploadOnCloudinary(req.files.image[0].buffer, "image");
      if (result) {
        image = { url: result.secure_url, public_id: result.public_id };
      }
    }

    if (req.files?.video?.[0]) {
      const result = await uploadOnCloudinary(req.files.video[0].buffer, "video");
      if (result) {
        video = { url: result.secure_url, public_id: result.public_id };
      }
    }

    const shop = await Shop.findOne({ owner: req.userId });
    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    const item = await Item.create({
      shop: shop._id,
      dishname,
      category,
      price,
      foodType,
      image,
      video,
    });

    shop.foodItems.push(item._id);

    await shop.save();
    await shop.populate("owner");
    await shop.populate({ path: "foodItems", options: { sort: { updatedAt: -1 } } });

    // Redis cache invalidation
    const shopCacheKey = `shopMenu:${shop._id}`;
    const cityCacheKey = `cityMenu:${shop.city.toLowerCase()}`;
    await redisClient.del(shopCacheKey);
    await redisClient.del(cityCacheKey);
    await redisClient.del("itemList");

    return res.status(201).json(shop);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      err: `Add item error ${error}`,
    });
  }
};



/**
 * Edit FoodItems Controller 
 * API - [/api/food/edit-item/:id]
 */

export const editItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { dishname, category, price, foodType } = req.body;

    const existingItem = await Item.findById(itemId);
    if (!existingItem) {
      return res.status(404).json({ error: "Item not found" });
    }

    let image = existingItem.image;
    let video = existingItem.video;

    if (req.files?.image?.[0]) {
      if (existingItem.image?.public_id) {
        await deleteFromCloudinary(existingItem.image.public_id, "image");
      }
      const result = await uploadOnCloudinary(req.files.image[0].buffer, "image");
      if (result) {
        image = { url: result.secure_url, public_id: result.public_id };
      }
    }

    if (req.files?.video?.[0]) {
      if (existingItem.video?.public_id) {
        await deleteFromCloudinary(existingItem.video.public_id, "video");
      }
      const result = await uploadOnCloudinary(req.files.video[0].buffer, "video");
      if (result) {
        video = { url: result.secure_url, public_id: result.public_id };
      }
    }

    await Item.findByIdAndUpdate(
      itemId,
      { dishname, category, price, foodType, image, video },
      { returnDocument: "after" }
    );

    const shop = await Shop.findOne({ owner: req.userId }).populate({
      path: "foodItems",
      options: { sort: { updatedAt: -1 } }
    });

    // Redis cache invalidation
    const shopCacheKey = `shopMenu:${shop._id}`;
    const cityCacheKey = `cityMenu:${shop.city.toLowerCase()}`;
    await redisClient.del(shopCacheKey);
    await redisClient.del(cityCacheKey);

    return res.status(200).json(shop);
  } catch (error) {
    res.status(500).json({ err: `Internal Server Error ${error}` });
  }
};



/**
 * Get FoodItem Controller 
 * API - [/api/food/get-item/:id]
 */

export const getItemById = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findById(id)

    if (!item) {
      return res.status(404).json({ message: "Food item not found" });
    }

    return res.status(200).json(item);
  } catch (error) {
    return res.status(500).json({ error: "Get Items Error" });
  }
}

/**
 * Food-partner Remove FoodItem Controller 
 * API - [/api/food/remove-item/:id]
 */

export const removeFoodItem = async (req, res) => {
  try {
    const { id } = req.params;

    const deleteFoodItem = await Item.findByIdAndDelete(id);
    if (!deleteFoodItem) {
      return res.status(404).json({ message: "Food item not found" });
    }

    if (deleteFoodItem.image?.public_id) {
      await deleteFromCloudinary(deleteFoodItem.image.public_id, "image");
    }

    if (deleteFoodItem.video?.public_id) {
      await deleteFromCloudinary(deleteFoodItem.video.public_id, "video");
    }

    const shop = await Shop.findOne({ owner: req.userId });
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    shop.foodItems = shop.foodItems.filter(
      i => i.toString() !== deleteFoodItem._id.toString()
    );

    await shop.save();
    await shop.populate({
      path: "foodItems",
      options: { sort: { updatedAt: -1 } }
    });

    // Redis cache invalidation
    const shopCacheKey = `shopMenu:${shop._id}`;
    const cityCacheKey = `cityMenu:${shop.city.toLowerCase()}`;
    await redisClient.del(shopCacheKey);
    await redisClient.del(cityCacheKey);

    res.status(200).json(shop);
  } catch (error) {
    res.status(500).json({ message: "Server error while removing food item" });
  }
};



/**
 * Get FoodItems By City Controller 
 * API - [/api/food/get-fooditems-by-city/:city]
 */

export const getItemByCity = async (req, res) => {
  try {
    const { city } = req.params;
    if (!city) {
      return res.status(400).json({ error: "City Not Found" });
    }

    const cacheKey = `cityMenu:${city.toLowerCase()}`;
    const cachedItems = await redisClient.get(cacheKey);
    if (cachedItems) {
      return res.status(200).json(JSON.parse(cachedItems));
    }

    const shops = await Shop.find({
      city: { $regex: new RegExp(`^${city}$`, "i") }
    }).populate("foodItems");

    if (!shops || shops.length === 0) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const shopIds = shops.map((shop) => shop._id);
    const items = await Item.find({ shop: { $in: shopIds } })
      .populate("shop", "restaurantName address");

    await redisClient.setEx(cacheKey, 900, JSON.stringify(items));

    return res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: `Get Items By City Error ${error}` });
  }
};


export const getItemByShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const cacheKey = `shopMenu:${shopId}`;

    const shopItems = await redisClient.get(cacheKey);
    if (shopItems) {
      return res.status(200).json(JSON.parse(shopItems));
    }

    const shop = await Shop.findById(shopId).populate("foodItems");
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    await redisClient.setEx(
      cacheKey,
      900,
      JSON.stringify({ shop, items: shop.foodItems })
    );

    return res.status(200).json({
      shop,
      items: shop.foodItems
    });
  } catch (error) {
    res.status(500).json({ message: `Get Items By Shop Error ${error}` });
  }
};


export const searchItems = async (req, res) => {
  try {
    const { query, city } = req.query;

    if (!query || !city) {
      return res.status(400).json({ error: "Search query and city are required" });
    }

    const shop = await Shop.find({
      city: { $regex: new RegExp(`^${city}$`, "i") }
    }).populate("foodItems")

    if (!shop) {
      return res.status(400).json({
        error: "Shop not found"
      })
    }

    const shopIds = shop.map((s) => s._id);

    const items = await Item.find({
      shop: { $in: shopIds },
      $or: [
        { dishname: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } }
      ]
    }).populate("shop", "restaurantName address image")

    return res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: `Search Items Error ${error}` });
  }
}

export const rating = async (req, res) => {
  try {
    const { itemId, rating } = req.body;

    if (!itemId || !rating) {
      return res.status(400).json({ err: "Item ID and rating are required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ err: "Rating must be between 1 and 5" });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ err: "Item not found" });
    }

    const newCount = item.rating.count + 1;
    const newAverage = (item.rating.average * item.rating.count + rating) / newCount

    item.rating.count = newCount;
    item.rating.average = newAverage;

    await item.save();

    return res.status(200).json({ rating: item.rating });

  } catch (error) {
    return res.status(500).json({ err: `update user rating error ${error}` });
  }
}

export const getAllItems = async (req, res) => {
  try {

    const { page, limit = 10 } = req.query;

    const redisData = await redisClient.get("itemList");

    if (redisData) {
      return res.status(200).json(JSON.parse(redisData));
    }

    const items = await Item.find()
      .populate({
        path: "shop",
        select: "image restaurantName owner",
        populate: {
          path: "owner",
          select: "fullname"
        }
      })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const filteredItems = items.map(item => ({
      dishname: item.dishname,
      shopImage: item.shop?.image,
      restaurantName: item.shop?.restaurantName,
      ownerFullname: item.shop?.owner?.fullname,
      videoUrl: item.video?.url
    }));

    await redisClient.setEx("itemList", 1800, JSON.stringify(filteredItems))

    return res.status(200).json(filteredItems);

  } catch (error) {
    return res.status(500).json({ err: `get all items error ${error}` });
  }
};




