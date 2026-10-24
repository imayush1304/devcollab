import { User } from '../models/User.js';
import { signToken } from '../utils/token.js';
import { ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors.js';

class AuthService {
  /**
   * Register a new user
   */
  async register({ name, email, password }) {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new ConflictError('An account with this email already exists');
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash
    });

    // Generate JWT token
    const token = signToken({ id: user._id, email: user.email });

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt
      },
      token
    };
  }

  /**
   * Authenticate user with email and password
   */
  async login({ email, password }) {
    const normalizedEmail = email.toLowerCase().trim();

    // Find user with password hash explicitly selected
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate JWT token
    const token = signToken({ id: user._id, email: user.email });

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt
      },
      token
    };
  }

  /**
   * Get user profile by ID
   */
  async getCurrentUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt
    };
  }
}

export const authService = new AuthService();
