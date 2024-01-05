import User from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        console.log(
            `Error Occured while generating access and refresh token: ${error}`
        );
    }
};

const registerUser = async (req, res) => {
    try {
        // get data from req.body
        const { userName, email, password, fullName } = req.body;

        // Validate data
        if (!userName || !email || !password || !fullName) {
            res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        // Check if user already exists
        const existedUser = await User.findOne({
            $or: [{ userName }, { email }],
        });

        if (existedUser) {
            res.status(409).json({
                success: false,
                message: "User already exists",
            });
        }

        // Handle avatar and cover image
        const avatarLocalPath = req.files?.avatar[0]?.path;
        const coverImageLocalPath = req.files?.coverImage
            ? req.files?.coverImage[0]?.path
            : "";

        if (!avatarLocalPath) {
            res.status(400).json({
                success: false,
                message: "Avatar is required",
            });
        }

        // Upload avatar and cover image to Cloudinary
        const avatar = await uploadOnCloudinary(avatarLocalPath);
        const coverImage = await uploadOnCloudinary(coverImageLocalPath);

        if (!avatar) {
            res.status(400).json({
                success: false,
                message: "Avatar upload failed",
            });
        }

        // Create new user object
        const user = await User.create({
            fullName,
            avatar: avatar?.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            userName: userName.toLowerCase(),
        });

        const createdUser = await User.findOne({ _id: user._id }).select(
            "-password -refreshToken"
        );

        if (!createdUser) {
            res.status(500).json({
                success: false,
                message: "Something went wrong while registering user",
            });
        }

        // send response
        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: createdUser,
        });
    } catch (error) {
        console.log(`Error Occured while registering user: ${error}`);
        res.status(500).json({
            success: false,
            message: "Something went wrong while registering user",
        });
    }
};

const loginUser = async (req, res) => {
    try {
        // get data from req.body
        const { email, password } = req.body;

        // Validate data
        if (!password || !email) {
            res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        // Check if user already exists
        const user = await User.findOne({ email });

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Check if password is correct
        const isPasswordValid = await user.isPasswordCorrect(password);

        if (!isPasswordValid) {
            res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        // Generate access and refresh token
        const { accessToken, refreshToken } =
            await generateAccessAndRefreshToken(user._id);

        // Create new user object
        const loggedInUser = await User.findOne({ _id: user._id }).select(
            "-password -refreshToken"
        );

        // send response
        const options = {
            httpOnly: true,
            secure: true,
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json({
                success: true,
                message: "User logged in successfully",
                data: {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
            });
    } catch (error) {
        console.log(`Error Occured while logging in user: ${error}`);
        res.status(500).json({
            success: false,
            message: "Something went wrong while logging in user",
        });
    }
};

const logoutUser = async (req, res) => {
    try {
        const userId = req.user._id;

        await User.findByIdAndUpdate(
            userId,
            {
                $set: { refreshToken: "" },
            },
            {
                new: true,
            }
        );

        const options = {
            httpOnly: true,
            secure: true,
        };

        return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json({
                success: true,
                message: "User logged out successfully",
            });
    } catch (error) {
        console.log(`Error Occured while logging out user: ${error}`);
        res.status(500).json({
            success: false,
            message: "Something went wrong while logging out user",
        });
    }
};

const refreshAccessToken = async (req, res) => {
    try {
        const incomingRefreshToken =
            req.cookie?.refreshToken || req.body?.refreshToken;

        if (!incomingRefreshToken) {
            return res.status(401).json({
                success: false,
                message: "Refresh Token not found",
            });
        }

        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (user?.refreshToken !== incomingRefreshToken) {
            return res.status(401).json({
                success: false,
                message: "Invalid Refresh Token",
            });
        }

        const { newAccessToken, newRefreshToken } =
            await user.generateAccessToken(user._id);

        const options = {
            httpOnly: true,
            secure: true,
        };

        return res
            .cookie("accessToken", newAccessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .status(200)
            .json({
                success: true,
                message: "Access Token refreshed successfully",
                data: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                },
            });
    } catch (error) {
        console.log(`Error Occured while refreshing access token: ${error}`);
        res.status(500).json({
            success: false,
            message: "Something went wrong while refreshing access token",
        });
    }
};

const changePassword = async (req, res) => {
    try {
        // get data from req.body
        const { oldPassword, newPassword, confirmPassword } = req.body;

        // Validate data
        if (!oldPassword || !newPassword || !confirmPassword) {
            res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        if (newPassword !== confirmPassword) {
            res.status(400).json({
                success: false,
                message: "New password and confirm password should match",
            });
        }

        const userId = req.user?._id;

        const user = await User.findById({ _id: userId });

        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

        if (!isPasswordCorrect) {
            res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        user.password = newPassword;

        await user.save({ validateBeforeSave: false });

        return res.status(200).json({
            success: true,
            message: "Password changed successfully",
        });
    } catch (error) {
        console.log(`Error Occured while changing password: ${error}`);
        res.status(500).json({
            success: false,
            message: "Something went wrong while changing password",
        });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: "Current user fetched successfully",
            data: req.user,
        });
    } catch (error) {
        console.log(`Error Occured while getting current user: ${error}`);
        res.status(500).json({
            success: false,
            message: "Something went wrong while getting current user",
        });
    }
};

const updateUserDetails = async (req, res) => {
    try {
        // get data from req.body
        const { email, fullName } = req.body;

        // Validate data
        if (!email || !fullName) {
            res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        const userId = req.user?._id;

        const user = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    email,
                    fullName,
                },
            },
            { new: true }
        ).select("-password");

        res.status(200).json({
            success: true,
            message: "User details updated successfully",
            data: user,
        });
    } catch (error) {
        console.log(`Error Occured while updating user: ${error}`);
        res.status(500).json({
            success: false,
            message: "Something went wrong while updating user",
        });
    }
};

const updateUserAvatar = async (req, res) => {
    try {
        const avatarLocalPath = req.files?.path;

        if (!avatarLocalPath) {
            res.status(400).json({
                success: false,
                message: "Avatar is required",
            });
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath);

        if (!avatar.url) {
            res.status(400).json({
                success: false,
                message: "Avatar upload failed",
            });
        }

        const userId = req.user?._id;

        const user = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    avatar: avatar.url,
                },
            },
            { new: true }
        ).select("-password");

        res.status(200).json({
            success: true,
            message: "User avatar updated successfully",
            data: user,
        });
    } catch (error) {
        console.log(`Error Occured while updating user avatar: ${error}`);
        res.status(500).json({
            success: false,
            message: "Something went wrong while updating user avatar",
        });
    }
};

const updateUserCoverImage = async (req, res) => {
    try {
        const coverImageLocalPath = req.files?.path;

        if (!coverImageLocalPath) {
            res.status(400).json({
                success: false,
                message: "Cover image is required",
            });
        }

        const coverImage = await uploadOnCloudinary(coverImageLocalPath);

        if (!coverImage.url) {
            res.status(400).json({
                success: false,
                message: "Cover image upload failed",
            });
        }

        const userId = req.user?._id;

        const user = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    coverImage: coverImage.url,
                },
            },
            { new: true }
        ).select("-password");

        res.status(200).json({
            success: true,
            message: "User cover image updated successfully",
            data: user,
        });
    } catch (error) {
        console.log(`Error Occured while updating user cover image: ${error}`);
        res.status(500).json({
            success: false,
            message: "Something went wrong while updating user cover image",
        });
    }
};

const getUserChannelProfile = async (req, res) => {
    try {
        const { userName } = req.params;

        if (!userName?.trim()) {
            res.status(400).json({
                success: false,
                message: "User name is required",
            });
        }

        const channel = await User.aggregate([
            {
                $match: {
                    userName: userName?.toLowerCase(),
                },
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers",
                },
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo",
                },
            },
            {
                $addFields: {
                    subscribersCount: { $size: "$subscribers" },
                    subscribedToCount: { $size: "$subscribedTo" },
                    isSubscribed: {
                        $cond: {
                            if: {
                                $in: [req.user?._id, "$subscribers.subscriber"],
                                then: true,
                                else: false,
                            },
                        },
                    },
                },
            },
            {
                $project: {
                    fullName: 1,
                    userName: 1,
                    avatar: 1,
                    coverImage: 1,
                    subscribersCount: 1,
                    subscribedToCount: 1,
                    isSubscribed: 1,
                },
            },
        ]);

        console.log(`Aggregated Data Channel: ${channel}`);

        if (!channel) {
            res.status(404).json({
                success: false,
                message: "Channel not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "User channel profile fetched successfully",
            data: channel[0],
        });
    } catch (error) {
        console.log(
            `Error Occured while getting user channel profile: ${error}`
        );
        res.status(500).json({
            success: false,
            message: "Something went wrong while getting user channel profile",
        });
    }
};

export {
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
};
