import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(
            process.env.MONGODB_URI
        );
        console.log(
            `MongoDB Connected to: ${connectionInstance.connection.host}`
        );
    } catch (error) {
        console.log(`Error Occured while connecting to DB: ${error}`);
        process.exit(1);
    }
};

export default connectDB;
