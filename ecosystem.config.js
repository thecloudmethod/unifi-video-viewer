module.exports = {
  apps : [{
    name: "unifi-video-viewer",
    script: "./dist/server.js",
    env: {
      NODE_ENV: "production",
      PORT: 80
    },
    env_development: {
      NODE_ENV: "development",
      PORT: 4001
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 80
    }
  }],
};
