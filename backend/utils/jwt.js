import jwt from "jsonwebtoken";

export const generateAccessToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

export const generateTokens = (user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
};

export const verifyAccessToken  = (t) => jwt.verify(t, process.env.JWT_SECRET);
export const verifyRefreshToken = (t) => jwt.verify(t, process.env.JWT_REFRESH_SECRET);
