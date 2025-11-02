import { Schema, model } from "mongoose";
import jwt from "jsonwebtoken";
const registeredUserSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
});

registeredUserSchema.methods.generateToken = function () {
  try {
    const token = jwt.sign(
      {
        _id: this._id.toString(),
        email: this.email,
      },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "2h",
      }
    );
    return token;
  } catch (e) {
    console.log(e);
    return null;
  }
};

const RegisterUserModel = model("registerUser", registeredUserSchema);

export default RegisterUserModel;
