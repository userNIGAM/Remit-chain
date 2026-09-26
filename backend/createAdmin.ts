import dotenv from "dotenv";
import bcrypt from "bcryptjs";

import connectDB from "./config/db.js";
import User from "./models/User.js";

dotenv.config();

const createAdmin = async (): Promise<void> => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Check if admin already exists
    const existingAdmin = await User.findOne({
      email: "admin@remitchain.com",
    });

    if (existingAdmin) {
      console.log("Admin already exists");
      process.exit(0);
    }

    // 3. Hash admin password
    const hashedPassword = await bcrypt.hash("Admin@123", 12);

    // 4. Create admin
    await User.create({
      name: "RemitChain Admin",
      email: "admin@remitchain.com",
      phone: "9800000000",
      password: hashedPassword,

      role: "admin",

      country: "Nepal",

      remitId: "NP-ADMIN01",

      verificationStatus: "verified",

      isActive: true,
    });

    console.log("Admin created successfully");

    console.log("Email: admin@remitchain.com");
    console.log("Password: Admin@123");

    process.exit(0);
  } catch (error) {
    console.error("Failed to create admin:", error);

    process.exit(1);
  }
};

createAdmin();
