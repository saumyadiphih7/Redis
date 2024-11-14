const express = require("express");
let fetch;
(async () => {
  fetch = (await import("node-fetch")).default;
})();
const redis = require("redis");

const PORT = process.env.PORT || 5000;

// Replace with xloud.io Redis connection details
const REDIS_HOST = "redis-19958.c246.us-east-1-4.ec2.redns.redis-cloud.com"; // e.g., "your-instance-name.xloud.io"
const REDIS_PORT = "19958"; // e.g., "12345"
const REDIS_PASSWORD = "xxfbemmnMjtpVluDWUctwwRAk8xfEyhG"; // only if required

// Create and connect the Redis client with xloud.io configuration
const client = redis.createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
  password: REDIS_PASSWORD, // Only if your instance requires a password
});

client.on("error", (err) => console.log("Redis Client Error", err));

// Connect the client
(async () => {
  await client.connect();
})();

const app = express();

// Set response
function setResponse(username, repos) {
  return `<h2>${username} has ${repos} GitHub repos</h2>`;
}

// Middleware to cache data
async function cache(req, res, next) {
  const { username } = req.params;

  try {
    const data = await client.get(username);
    if (data !== null) {
      console.log("Cache hit");
      res.send(setResponse(username, data));
    } else {
      console.log("Cache miss");
      next();
    }
  } catch (err) {
    console.error("Redis GET error", err);
    res.status(500).send("Internal Server Error");
  }
}

// Function to fetch data from GitHub and store it in Redis
async function getRepos(req, res) {
  try {
    console.log("Fetching data from GitHub...");

    const { username } = req.params;
    const response = await fetch(`https://api.github.com/users/${username}`);
    const data = await response.json();

    if (!data.public_repos && data.public_repos !== 0) {
      return res
        .status(404)
        .send("User not found or has no public repositories.");
    }

    const repos = data.public_repos;

    // Set data to Redis with an expiration time of 1 hour (3600 seconds)
    await client.setEx(username, 3600, JSON.stringify(repos));

    res.send(setResponse(username, repos));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching data from GitHub");
  }
}

app.get("/repos/:username", cache, getRepos);

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
