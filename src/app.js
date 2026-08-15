import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";


const app = express();


/*
 * Global middlewares
 */

app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    })
);

app.use(
    express.json({
        limit: "64kb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "64kb"
    })
);

app.use(
    express.static("public")
);

app.use(cookieParser());


/*
 * Routes
 */

import userRoutes from "../routes/user.routes.js";
import videoRoutes from "../routes/video.route.js";
import commentRoutes from "../routes/comment.route.js";
import dashboardRoutes from "../routes/dashboard.route.js";
import likeRoutes from "../routes/like.route.js";
import playlistRoutes from "../routes/playlist.route.js";
import subscriptionRoutes from "../routes/subscription.route.js";
import tweetRoutes from "../routes/tweet.route.js";


/*
 * API routes
 */

app.use(
    "/api/v1/users",
    userRoutes
);

app.use(
    "/api/v1/videos",
    videoRoutes
);

app.use(
    "/api/v1/comments",
    commentRoutes
);

app.use(
    "/api/v1/dashboard",
    dashboardRoutes
);

app.use(
    "/api/v1/likes",
    likeRoutes
);

app.use(
    "/api/v1/playlists",
    playlistRoutes
);

app.use(
    "/api/v1/subscriptions",
    subscriptionRoutes
);

app.use(
    "/api/v1/tweets",
    tweetRoutes
);

// Global error-handling middleware
// app.use((err, req, res, next) => {
//     const statusCode = err.statusCode || 500;

//     return res.status(statusCode).json({
//         statusCode,
//         message: err.message || "Internal Server Error",
//         success: false,
//         errors: err.errors || [],
//         data: null
//     });
// });
/*app.use((err, req, res, next) => {
    console.error(err.stack);

    const statusCode = err.statusCode || 500;

    return res.status(statusCode).json({
        statusCode,
        message: err.message || "Internal Server Error",
        success: false,
        errors: err.errors || [],
        data: null
    });
});*/
app.use((err, req, res, next) => {
    console.error("========== ERROR ==========");
    console.error(err);
    console.error(err.stack);
    console.error("===========================");

    const statusCode = err.statusCode || 500;

    return res.status(statusCode).json({
        statusCode,
        message: err.message || "Internal Server Error",
        success: false,
        errors: err.errors || [],
        data: null
    });
});


export default app;