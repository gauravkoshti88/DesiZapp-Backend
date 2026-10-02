import redis from 'redis';

let client = null;
let isConnected = false;

if (process.env.REDIS_URL) {
  try {
    client = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            console.log("Redis reconnection attempts exhausted. Operating in fallback mode.");
            return false;
          }
          return Math.min(retries * 500, 3000);
        }
      }
    });

    client.on("error", (err) => {
      console.warn("Redis Warning / Error (gracefully continuing):", err.message || err);
      isConnected = false;
    });

    client.on("connect", () => {
      isConnected = true;
      console.log("Redis Connected Successfully");
    });

    client.on("ready", () => {
      isConnected = true;
    });

    client.on("end", () => {
      isConnected = false;
    });

    client.connect().catch((err) => {
      console.warn("Redis initial connection failed (continuing without cache):", err.message || err);
      isConnected = false;
    });
  } catch (error) {
    console.warn("Failed to initialize Redis client:", error.message || error);
    client = null;
    isConnected = false;
  }
} else {
  console.log("No REDIS_URL provided. Operating in direct database mode.");
}

// Graceful wrapper that avoids crashing if Redis is offline
const safeRedisClient = {
  get: async (key) => {
    if (!isConnected || !client) return null;
    try {
      return await client.get(key);
    } catch (err) {
      console.warn(`Redis get("${key}") failed:`, err.message);
      return null;
    }
  },
  setEx: async (key, seconds, value) => {
    if (!isConnected || !client) return null;
    try {
      return await client.setEx(key, seconds, value);
    } catch (err) {
      console.warn(`Redis setEx("${key}") failed:`, err.message);
      return null;
    }
  },
  del: async (key) => {
    if (!isConnected || !client) return null;
    try {
      return await client.del(key);
    } catch (err) {
      console.warn(`Redis del("${key}") failed:`, err.message);
      return null;
    }
  }
};

export default safeRedisClient;