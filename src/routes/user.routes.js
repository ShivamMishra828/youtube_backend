import { Router } from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    getCurrentUser,
    updateUserDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import multer from "multer";

const router = Router();

router.post(
    "/register",
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "coverImage", maxCount: 1 },
    ]),
    registerUser
);

router.post("/login", loginUser);

router.post("/logout", verifyJWT, logoutUser);

router.post("/refresh-token", refreshAccessToken);

router.post("/change-passowrd", verifyJWT, changePassword);

router.get("/get-user", verifyJWT, getCurrentUser);

router.patch("/update-user", verifyJWT, updateUserDetails);

router.patch("/avatar", verifyJWT, upload.single("avatar"), updateUserAvatar);

router.patch(
    "/cover-image",
    verifyJWT,
    upload.single("coverImage"),
    updateUserCoverImage
);

router.get("/c/:userName", verifyJWT, getUserChannelProfile);

router.get("/history", verifyJWT, getWatchHistory);

export default router;
