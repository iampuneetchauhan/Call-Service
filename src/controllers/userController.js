import RegisterUserModel from "../model/login.model.js";
import jwt from "jsonwebtoken";

import express from "express";
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Token missing" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const getAllUsers = async (req, res) => {
  const { search } = req.query;
  try {
    const query = search ? { name: { $regex: search, $options: "i" } } : {};
    const users = await RegisterUserModel.find(query).select("-password");
    return res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


