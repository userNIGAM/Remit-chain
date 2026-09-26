import mongoose from "mongoose";
import dotenv from "dotenv"

dotenv.config()
// declare const process: {
//   env: { MONGO_URI?: string };
//   exit: (code?: number) => never;
// };

const connectDB = async (): Promise<void> => {
  try {
    // Connect to MongoDB using the connection string
    // stored in the environment variable.
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI environment variable is not set");
    }

    const connection = await mongoose.connect(
      mongoUri
    );

    console.log(
      `MongoDB connected: ${connection.connection.host}`
    );
  } catch (error) {
    console.error("MongoDB connection failed:", error);

    // Stop the application if database connection fails.
    process.exit(1);
  }
};

export default connectDB;