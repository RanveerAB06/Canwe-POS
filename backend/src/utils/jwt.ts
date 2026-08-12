import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_access_token_key_123!';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super_secret_jwt_refresh_token_key_456!';

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  restaurantId: string | null;
  branchId: string | null;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload: { id: string }): string => {
  return jwt.sign(
    { id: payload.id, nonce: Math.random().toString(36).substring(2) },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

export const verifyRefreshToken = (token: string): { id: string } => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as { id: string };
};
