import redis from "redis";

let client = null;
let isConnected = false;

const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  try {
    client = redis.createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => {
          if (retries >= 5) {
            console.warn(
              "Redis reconnection attempts exhausted. Operating in fallback mode.",
            );

            return false;
          }

          return Math.min(retries * 500, 3000);
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

          console.warn(
            "Redis PING failed (continuing without cache):",
            error?.message || error,
          );
        }
      })
      .catch((err) => {
        isConnected = false;

        console.warn(
          "Redis initial connection failed (continuing without cache):",
          err?.message || err,
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
    if (!client || !isConnected) {
      return null;
    }

    try {
      return await client.get(key);
    } catch (err) {
      isConnected = false;

      console.warn(`Redis get("${key}") failed:`, err?.message || err);

      return null;
    }
  },

  setEx: async (key, seconds, value) => {
    if (!client || !isConnected) {
      return null;
    }

    try {
      return await client.setEx(key, seconds, value);
    } catch (err) {
      isConnected = false;

      console.warn(`Redis setEx("${key}") failed:`, err?.message || err);

      return null;
    }
  },

  del: async (key) => {
    if (!client || !isConnected) {
      return null;
    }

    try {
      return await client.del(key);
    } catch (err) {
      isConnected = false;

      console.warn(`Redis del("${key}") failed:`, err?.message || err);

      return null;
    }
  },

  ping: async () => {
    if (!client || !isConnected) {
      return null;
    }

    try {
      return await client.ping();
    } catch (err) {
      isConnected = false;

      console.warn("Redis ping failed:", err?.message || err);

      return null;
    }
  },
};

export default safeRedisClient;
