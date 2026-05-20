import User from "../models/user.model.js";
import Shop from "../models/shop.model.js";
import Item from "../models/item.model.js";
import aiClient from "../utils/openaiClient.js";

export const getAiSuggestions = async (req, res) => {
    try {
        const userId = req.userId;

        // User + Order History fetch karo
        const user = await User.findById(userId).populate({
            path: "orderHistory",
            populate: {
                path: "shopOrders",
                populate: {
                    path: "shopOrderItems.item",
                    model: "Item"
                }
            }
        });

        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        if (!user.orderHistory || user.orderHistory.length === 0) {
            return res.json({ success: true, recommendations: [] });
        }

        // 🔥 Collect ordered items (dishname + category)
        const orderedItems = user.orderHistory.flatMap(order =>
            order.shopOrders.flatMap(shopOrder =>
                shopOrder.shopOrderItems.map(itemObj => ({
                    name: itemObj.item?.dishname || itemObj.dishname || "Unknown Dish",
                    category: itemObj.item?.category || "Others"
                }))
            )
        );

        const orderedNames = orderedItems.map(i => i.name);
        const orderedCategories = orderedItems.map(i => i.category);

        console.log("Ordered Names:", orderedNames);
        console.log("Ordered Categories:", orderedCategories);

        // 🔥 Find user's city from last order
        const lastOrder = user.orderHistory[user.orderHistory.length - 1];
        const shopId = lastOrder.shopOrders[0]?.shop;
        const shop = await Shop.findById(shopId);
        const userCity = shop?.city || "Unknown";

        // 🔥 Get available food items in same city shops
        const cityShops = await Shop.find({ city: userCity }).populate("foodItems");
        const availableItems = cityShops.flatMap(s => s.foodItems.filter(f => f.isAvailable));

        // ✅ Filter available items by ordered categories + name similarity
        const filteredItems = availableItems.filter(item =>
            orderedCategories.includes(item.category) &&
            orderedNames.some(name =>
                item.dishname.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(item.dishname.toLowerCase())
            )
        );

        // 🔥 Prompt for AI
        const prompt = `User has ordered these items: ${orderedNames.join(", ")} in categories: ${[...new Set(orderedCategories)].join(", ")}.
    Suggest 5 food items from these categories that are available in shops located in ${userCity}.
    Only suggest dishes that have related names or categories to the user's order history.
    Keep suggestions short and clear (just dish names).`;

        let suggestions = [];
        let message = "";

        try {
            const response = await aiClient.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
            });

            const suggestionsText = response.choices[0].message.content;
            let aiSuggestions = suggestionsText.split("\n").filter(s => s.trim() !== "");

            // ✅ Filter AI suggestions to only those available in city shops + same category + name similarity
            suggestions = aiSuggestions.filter(s =>
                filteredItems.some(item =>
                    item.dishname.toLowerCase().includes(s.toLowerCase())
                )
            );

            message = "AI-powered name + category-based recommendations generated successfully.";
        } catch (apiError) {
            console.error("OpenAI API Error:", apiError.message);
            // Fallback: recommend filtered items directly
            suggestions = filteredItems.slice(0, 5).map(item => item.dishname);
            message = "Fallback name + category-based recommendations generated (OpenAI quota exceeded).";
        }

        // 🔥 Update AI Recommendation Score
        const score = orderedItems.length;
        await User.findByIdAndUpdate(userId, { $set: { aiRecommendationScore: score } });

        return res.json({
            success: true,
            recommendations: suggestions,
            aiRecommendationScore: score,
            message
        });

    } catch (error) {
        console.error("AI Suggestion Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error generating AI suggestions",
            error: error.message,
        });
    }
};


