import redis from "redis";

let client = null;
let isConnected = false;

if (process.env.REDIS_URL) {
  try {
    client = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 15000,
        reconnectStrategy: (retries) => {
          if (retries >= 5) {
            console.warn(
              "Redis reconnection attempts exhausted. Operating in fallback mode.",
            );
            return false;
          }

          return Math.min(retries * 1000, 5000);
        },
      },
    });

    client.on("connect", () => {
      console.log("Redis connecting...");
    });

    client.on("ready", () => {
      isConnected = true;
      console.log("Redis Connected Successfully");
    });

    client.on("end", () => {
      isConnected = false;
      console.warn("Redis connection closed.");
    });

    client.on("error", (err) => {
      isConnected = false;
      console.warn(
        "Redis Warning / Error (gracefully continuing):",
        err?.message || err,
      );
    });

    client
      .connect()
      .then(async () => {
        try {
          const result = await client.ping();

          if (result === "PONG") {
            isConnected = true;
            console.log("Redis PING successful: PONG");
          }
        } catch (error) {
          isConnected = false;
          console.warn("Redis PING failed:", error?.message || error);
        }
      })
      .catch((error) => {
        isConnected = false;
        console.warn(
          "Redis initial connection failed:",
          error?.message || error,
        );
      });
  } catch (error) {
    console.warn("Failed to initialize Redis client:", error?.message || error);

    client = null;
    isConnected = false;
  }
} else {
  console.log("No REDIS_URL provided. Operating in direct database mode.");
}

const safeRedisClient = {
  get: async (key) => {
    if (!client || !isConnected) return null;

    try {
      return await client.get(key);
    } catch (error) {
      console.warn(`Redis get("${key}") failed:`, error?.message || error);
      return null;
    }
  },

  setEx: async (key, seconds, value) => {
    if (!client || !isConnected) return null;

    try {
      return await client.setEx(key, seconds, value);
    } catch (error) {
      console.warn(`Redis setEx("${key}") failed:`, error?.message || error);
      return null;
    }
  },

  del: async (key) => {
    if (!client || !isConnected) return null;

    try {
      return await client.del(key);
    } catch (error) {
      console.warn(`Redis del("${key}") failed:`, error?.message || error);
      return null;
    }
  },
};

export default safeRedisClient;
