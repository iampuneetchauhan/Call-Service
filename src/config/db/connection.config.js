import mongoose from "mongoose";

const connection = async () => {
  try {
    await mongoose.connect(`${process.env.MONGOOSE_URI}`);
    console.log("mongodb connection established succesfully");
  } catch (E) {
    console.log("error while connecting mongoose:", E);
  }
};

export default connection;
