import bcrypt from "bcrypt";
import RegisterUserModel from "../model/login.model.js";

// ✅ Register Controller
export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // check if user already exists
    const existingUser = await RegisterUserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create new user
    const newUser = new RegisterUserModel({
      name,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    console.log("User registered successfully");

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error("Error while registering user:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Login Controller
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const existingUser = await RegisterUserModel.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({ message: "User does not exist" });
    }

    // compare passwords
    const isPasswordSame = await bcrypt.compare(
      password,
      existingUser.password
    );
    if (!isPasswordSame) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // generate JWT
    const token = existingUser.generateToken();

    return res.status(200).json({
      token: {
        accessToken: token,
        expiresIn: "2h",
      },
      user: {
        _id: existingUser._id,
        name: existingUser.name,
        email: existingUser.email,
      },
    });
  } catch (err) {
    console.error("Error during login:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
