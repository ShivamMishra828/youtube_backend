import User from "../models/user.model.js";
import uploadOnCloudinary from "../utils/uploadOnCloudinary.js";

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
        const coverImageLocalPath = req.files?.coverImage[0]?.path;

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

export { registerUser };
