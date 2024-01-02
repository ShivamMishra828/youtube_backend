import jsonwebtoken from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const verifyJWT = async (req, res, next) => {
    try {
        const accessToken =
            req.cookies?.accessToken ||
            req.headers("Authorization")?.replace("Bearer ", "");

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: "Access Token not found",
            });
        }

        const decodedAccessToken = jsonwebtoken.verify(
            accessToken,
            process.env.ACCESS_TOKEN_SECRET
        );

        const user = await User.findById(decodedAccessToken._id).select(
            "-password -refreshToken"
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid Access Token",
            });
        }

        req.user = user;

        next();
    } catch (error) {
        console.log(`Error Occured while verifying JWT: ${error}`);
        res.status(500).json({
            success: false,
            message: "Something went wrong while verifying JWT",
        });
    }
};
