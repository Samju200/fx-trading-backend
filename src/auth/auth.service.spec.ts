import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { User, UserRole } from "./entities/user.entity";
import { OTP } from "./entities/otp.entity";
import { Wallet } from "./../wallet/entities/wallet.entity";
import { MailService } from "./../common/services/mail.service";

describe("AuthService", () => {
  let service: AuthService;
  let userRepository: any;
  let otpRepository: any;
  let walletRepository: any;
  let jwtService: any;
  let configService: any;
  let mailService: any;

  beforeEach(async () => {
    const mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockOtpRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockWalletRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config = {
          OTP_EXPIRATION_MINUTES: "10",
          MAX_LOGIN_ATTEMPTS: "5",
          LOCKOUT_DURATION_MINUTES: "15",
          JWT_EXPIRATION: "7d",
        };
        return config[key];
      }),
    };

    const mockMailService = {
      sendOtpEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(OTP),
          useValue: mockOtpRepository,
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    otpRepository = module.get(getRepositoryToken(OTP));
    walletRepository = module.get(getRepositoryToken(Wallet));
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    mailService = module.get(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("register", () => {
    it("should successfully register a new user", async () => {
      const registerDto = {
        email: "test@example.com",
        password: "SecurePass123!",
        firstName: "John",
        lastName: "Doe",
      };

      const mockUser = {
        id: "user-1",
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: UserRole.USER,
        isVerified: false,
      } as User;

      const mockWallet = {
        id: "wallet-1",
        userId: mockUser.id,
      };

      const mockOtp = {
        id: "otp-1",
        userId: mockUser.id,
        code: "123456",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      walletRepository.create.mockReturnValue(mockWallet);
      walletRepository.save.mockResolvedValue(mockWallet);
      otpRepository.create.mockReturnValue(mockOtp);
      otpRepository.save.mockResolvedValue(mockOtp);
      mailService.sendOtpEmail.mockResolvedValue(undefined);

      const result = await service.register(registerDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(userRepository.create).toHaveBeenCalledWith(registerDto);
      expect(userRepository.save).toHaveBeenCalledWith(mockUser);
      expect(walletRepository.create).toHaveBeenCalledWith({
        userId: mockUser.id,
      });
      expect(walletRepository.save).toHaveBeenCalled();
      expect(otpRepository.create).toHaveBeenCalled();
      expect(mailService.sendOtpEmail).toHaveBeenCalled();
      expect(result).toEqual({
        message: "Registration successful. Please check your email for OTP.",
        userId: mockUser.id,
      });
    });

    it("should throw ConflictException if user already exists", async () => {
      const registerDto = {
        email: "existing@example.com",
        password: "SecurePass123!",
        firstName: "Jane",
        lastName: "Doe",
      };

      const existingUser = {
        id: "user-1",
        email: registerDto.email,
      } as User;

      userRepository.findOne.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        "User with this email already exists",
      );
    });

    it("should generate 6-digit OTP", async () => {
      const registerDto = {
        email: "test@example.com",
        password: "SecurePass123!",
        firstName: "John",
        lastName: "Doe",
      };

      const mockUser = { id: "user-1", email: registerDto.email } as User;

      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      walletRepository.create.mockReturnValue({});
      walletRepository.save.mockResolvedValue({});
      otpRepository.create.mockImplementation((data) => data);
      otpRepository.save.mockResolvedValue({});
      mailService.sendOtpEmail.mockResolvedValue(undefined);

      await service.register(registerDto);

      const otpCreateCall = otpRepository.create.mock.calls[0][0];
      expect(otpCreateCall.code).toMatch(/^\d{6}$/);
      expect(otpCreateCall.code.length).toBe(6);
    });
  });

  describe("verifyOtp", () => {
    it("should successfully verify OTP and return token", async () => {
      const verifyOtpDto = {
        email: "test@example.com",
        otp: "123456",
      };

      const mockUser = {
        id: "user-1",
        email: verifyOtpDto.email,
        isVerified: false,
        role: UserRole.USER,
      } as User;

      const mockOtp = {
        id: "otp-1",
        userId: mockUser.id,
        code: verifyOtpDto.otp,
        isUsed: false,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        isExpired: jest.fn(() => false),
      } as any;

      const mockToken = "jwt-token-123";

      userRepository.findOne.mockResolvedValue(mockUser);
      otpRepository.findOne.mockResolvedValue(mockOtp);
      otpRepository.save.mockResolvedValue(mockOtp);
      userRepository.save.mockResolvedValue({ ...mockUser, isVerified: true });
      jwtService.sign.mockReturnValue(mockToken);

      const result = await service.verifyOtp(verifyOtpDto);

      expect(mockOtp.isUsed).toBe(true);
      expect(mockOtp.usedAt).toBeDefined();
      expect(result.message).toBe("Email verified successfully");
      expect(result.accessToken).toBe(mockToken);
      expect(result.user.email).toBe(verifyOtpDto.email);
    });

    it("should throw NotFoundException if user not found", async () => {
      const verifyOtpDto = {
        email: "nonexistent@example.com",
        otp: "123456",
      };

      userRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException if user already verified", async () => {
      const verifyOtpDto = {
        email: "test@example.com",
        otp: "123456",
      };

      const mockUser = {
        id: "user-1",
        email: verifyOtpDto.email,
        isVerified: true,
      } as User;

      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        "User already verified",
      );
    });

    it("should throw UnauthorizedException if OTP is invalid", async () => {
      const verifyOtpDto = {
        email: "test@example.com",
        otp: "000000",
      };

      const mockUser = {
        id: "user-1",
        email: verifyOtpDto.email,
        isVerified: false,
      } as User;

      userRepository.findOne.mockResolvedValue(mockUser);
      otpRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        "Invalid OTP",
      );
    });

    it("should throw UnauthorizedException if OTP is expired", async () => {
      const verifyOtpDto = {
        email: "test@example.com",
        otp: "123456",
      };

      const mockUser = {
        id: "user-1",
        email: verifyOtpDto.email,
        isVerified: false,
      } as User;

      const mockOtp = {
        id: "otp-1",
        userId: mockUser.id,
        code: verifyOtpDto.otp,
        isUsed: false,
        expiresAt: new Date(Date.now() - 1000),
        isExpired: jest.fn(() => true),
      } as any;

      userRepository.findOne.mockResolvedValue(mockUser);
      otpRepository.findOne.mockResolvedValue(mockOtp);

      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        "OTP has expired",
      );
    });
  });

  describe("login", () => {
    it("should successfully login with valid credentials", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      const mockUser = {
        id: "user-1",
        email: loginDto.email,
        isVerified: true,
        loginAttempts: 0,
        lockedUntil: null,
        validatePassword: jest.fn().mockResolvedValue(true),
        isLocked: jest.fn(() => false),
        role: UserRole.USER,
      } as any;

      const mockToken = "jwt-token-123";

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue(mockToken);

      const result = await service.login(loginDto);

      expect(mockUser.validatePassword).toHaveBeenCalledWith(loginDto.password);
      expect(mockUser.loginAttempts).toBe(0);
      expect(mockUser.lastLoginAt).toBeDefined();
      expect(result.accessToken).toBe(mockToken);
      expect(result.user.email).toBe(loginDto.email);
    });

    it("should throw UnauthorizedException if user not found", async () => {
      const loginDto = {
        email: "nonexistent@example.com",
        password: "SecurePass123!",
      };

      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        "Invalid credentials",
      );
    });

    it("should throw UnauthorizedException if account is locked", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      const mockUser = {
        id: "user-1",
        email: loginDto.email,
        lockedUntil: lockUntil,
        isLocked: jest.fn(() => true),
      } as any;

      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        /Account is locked/,
      );
    });

    it("should increment login attempts on invalid password", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "WrongPassword123!",
      };

      const mockUser = {
        id: "user-1",
        email: loginDto.email,
        isVerified: true,
        loginAttempts: 2,
        validatePassword: jest.fn().mockResolvedValue(false),
        isLocked: jest.fn(() => false),
      } as any;

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockUser.loginAttempts).toBe(3);
      expect(userRepository.save).toHaveBeenCalledWith(mockUser);
    });

    it("should lock account after max failed attempts", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "WrongPassword123!",
      };

      const mockUser = {
        id: "user-1",
        email: loginDto.email,
        isVerified: true,
        loginAttempts: 4,
        lockedUntil: null,
        validatePassword: jest.fn().mockResolvedValue(false),
        isLocked: jest.fn(() => false),
      } as any;

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockUser.loginAttempts).toBe(5);
      expect(mockUser.lockedUntil).toBeDefined();
      expect(mockUser.lockedUntil.getTime()).toBeGreaterThan(Date.now());
    });

    it("should throw UnauthorizedException if email not verified", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      const mockUser = {
        id: "user-1",
        email: loginDto.email,
        isVerified: false,
        validatePassword: jest.fn().mockResolvedValue(true),
        isLocked: jest.fn(() => false),
      } as any;

      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        "Please verify your email before logging in",
      );
    });

    it("should reset login attempts on successful login", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      const mockUser = {
        id: "user-1",
        email: loginDto.email,
        isVerified: true,
        loginAttempts: 3,
        lockedUntil: new Date(Date.now() - 1000),
        validatePassword: jest.fn().mockResolvedValue(true),
        isLocked: jest.fn(() => false),
        role: UserRole.USER,
      } as any;

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue("token");

      await service.login(loginDto);

      expect(mockUser.loginAttempts).toBe(0);
      expect(mockUser.lockedUntil).toBeNull();
    });
  });

  describe("resendOtp", () => {
    it("should resend OTP successfully", async () => {
      const email = "test@example.com";

      const mockUser = {
        id: "user-1",
        email,
        isVerified: false,
        firstName: "John",
      } as User;

      const mockOtp = {
        id: "otp-1",
        userId: mockUser.id,
        code: "654321",
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      otpRepository.create.mockReturnValue(mockOtp);
      otpRepository.save.mockResolvedValue(mockOtp);
      mailService.sendOtpEmail.mockResolvedValue(undefined);

      const result = await service.resendOtp(email);

      expect(otpRepository.create).toHaveBeenCalled();
      expect(mailService.sendOtpEmail).toHaveBeenCalled();
      expect(result.message).toBe("OTP sent successfully");
    });

    it("should throw NotFoundException if user not found", async () => {
      const email = "nonexistent@example.com";

      userRepository.findOne.mockResolvedValue(null);

      await expect(service.resendOtp(email)).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if user already verified", async () => {
      const email = "test@example.com";

      const mockUser = {
        id: "user-1",
        email,
        isVerified: true,
      } as User;

      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.resendOtp(email)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resendOtp(email)).rejects.toThrow(
        "User already verified",
      );
    });
  });

  describe("validateUser", () => {
    it("should return user if valid and active", async () => {
      const userId = "user-1";
      const mockUser = {
        id: userId,
        email: "test@example.com",
        isActive: true,
      } as User;

      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser(userId);

      expect(result).toEqual(mockUser);
    });

    it("should throw UnauthorizedException if user not found", async () => {
      const userId = "nonexistent";

      userRepository.findOne.mockResolvedValue(null);

      await expect(service.validateUser(userId)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if user is inactive", async () => {
      const userId = "user-1";
      const mockUser = {
        id: userId,
        email: "test@example.com",
        isActive: false,
      } as User;

      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.validateUser(userId)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("Token Generation", () => {
    it("should generate JWT with correct payload", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      const mockUser = {
        id: "user-1",
        email: loginDto.email,
        role: UserRole.USER,
        isVerified: true,
        validatePassword: jest.fn().mockResolvedValue(true),
        isLocked: jest.fn(() => false),
        loginAttempts: 0,
      } as any;

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue("token");

      await service.login(loginDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        },
        { expiresIn: "7d" },
      );
    });
  });

  describe("User Sanitization", () => {
    it("should not include sensitive fields in response", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      const mockUser = {
        id: "user-1",
        email: loginDto.email,
        password: "hashed-password",
        loginAttempts: 0,
        lockedUntil: null,
        isVerified: true,
        validatePassword: jest.fn().mockResolvedValue(true),
        isLocked: jest.fn(() => false),
        role: UserRole.USER,
      } as any;

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue("token");

      const result = await service.login(loginDto);

      expect(result.user).not.toHaveProperty("password");
      expect(result.user).not.toHaveProperty("loginAttempts");
      expect(result.user).not.toHaveProperty("lockedUntil");
    });
  });
});
