import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { User } from "./entities/user.entity";
import { OTP } from "./entities/otp.entity";
import { Wallet } from "../wallet/entities/wallet.entity";
import { RegisterDto, VerifyOtpDto, LoginDto } from "./dto/auth.dto";
import { MailService } from "../common/services/mail.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(OTP)
    private otpRepository: Repository<OTP>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    // Create user
    const user = this.userRepository.create({
      email,
      password,
      firstName,
      lastName,
    });

    await this.userRepository.save(user);

    // Create wallet for user
    const wallet = this.walletRepository.create({
      userId: user.id,
    });
    await this.walletRepository.save(wallet);

    // Generate and send OTP
    await this.generateAndSendOtp(user);

    return {
      message: "Registration successful. Please check your email for OTP.",
      userId: user.id,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    // Find user
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.isVerified) {
      throw new BadRequestException("User already verified");
    }

    // Find valid OTP
    const otpRecord = await this.otpRepository.findOne({
      where: {
        userId: user.id,
        code: otp,
        isUsed: false,
      },
      order: { createdAt: "DESC" },
    });

    if (!otpRecord) {
      throw new UnauthorizedException("Invalid OTP");
    }

    if (otpRecord.isExpired()) {
      throw new UnauthorizedException("OTP has expired");
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    otpRecord.usedAt = new Date();
    await this.otpRepository.save(otpRecord);

    // Verify user
    user.isVerified = true;
    await this.userRepository.save(user);

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      message: "Email verified successfully",
      accessToken: token,
      user: this.sanitizeUser(user),
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check if account is locked
    if (user.isLocked()) {
      throw new UnauthorizedException(
        `Account is locked. Try again after ${user.lockedUntil}`,
      );
    }

    // Validate password
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      user.loginAttempts += 1;

      const maxAttempts =
        parseInt(this.configService.get("MAX_LOGIN_ATTEMPTS") ?? "5", 10) || 5;
      if (user.loginAttempts >= maxAttempts) {
        const lockoutDuration =
          parseInt(
            this.configService.get("LOCKOUT_DURATION_MINUTES") ?? "15",
            10,
          ) || 15;
        user.lockedUntil = new Date(Date.now() + lockoutDuration * 60 * 1000);
      }

      await this.userRepository.save(user);
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check if email is verified
    if (!user.isVerified) {
      throw new UnauthorizedException(
        "Please verify your email before logging in",
      );
    }

    // Reset login attempts and update last login
    user.loginAttempts = 0;
    user.lockedUntil = null as any;
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Generate token
    const token = this.generateToken(user);

    return {
      accessToken: token,
      user: this.sanitizeUser(user),
    };
  }

  async resendOtp(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.isVerified) {
      throw new BadRequestException("User already verified");
    }

    await this.generateAndSendOtp(user);

    return {
      message: "OTP sent successfully",
    };
  }

  private async generateAndSendOtp(user: User) {
    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Calculate expiration
    const expirationMinutes =
      parseInt(this.configService.get("OTP_EXPIRATION_MINUTES") ?? "10", 10) ||
      10;
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

    // Save OTP
    const otp = this.otpRepository.create({
      userId: user.id,
      code,
      expiresAt,
    });
    await this.otpRepository.save(otp);

    // Send email
    await this.mailService.sendOtpEmail(user.email, code, user.firstName);
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get("JWT_EXPIRATION") || "7d",
    });
  }

  private sanitizeUser(user: User) {
    const { password, loginAttempts, lockedUntil, ...sanitized } = user;
    return sanitized;
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User not found or inactive");
    }
    return user;
  }
}
