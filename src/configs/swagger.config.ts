import swaggerJsdoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Paycasso API Documentation",
    version: "1.0.0",
    description:
      "Stablecoin-powered Escrow Platform API - Smart contract escrow, gasless USDC transactions, and DAO-based dispute resolution",
    contact: {
      name: "Paycasso Team",
      email: "business@paycasso.app",
      url: "https://www.paycasso.app",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Development Server",
    },
    {
      url: "https://api.paycasso.app",
      description: "Production Server",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your JWT token",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string", example: "clx1234567890" },
          username: { type: "string", example: "john_doe_a3f" },
          name: { type: "string", example: "John Doe" },
          email: {
            type: "string",
            format: "email",
            example: "john@example.com",
          },
          imageUrl: {
            type: "string",
            example: "https://example.com/avatar.jpg",
          },
          bio: { type: "string", example: "Freelance developer" },
          role: {
            type: "string",
            enum: ["USER", "ADMIN", "MODERATOR"],
            example: "USER",
          },
          isVerified: { type: "boolean", example: false },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Wallet: {
        type: "object",
        properties: {
          id: { type: "string" },
          address: {
            type: "string",
            example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          },
          usdcBalance: { type: "number", example: 150.5 },
          coinbaseWalletId: { type: "string" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Error message" },
        },
      },
    },
  },
  tags: [
    { name: "Authentication", description: "User authentication endpoints" },
    { name: "User", description: "User profile management" },
    { name: "Wallet", description: "Wallet and financial operations" },
    { name: "Transfer", description: "USDC transfer operations" },
    { name: "Dispute", description: "Dispute resolution system" },
  ],
};

const options = {
  swaggerDefinition,
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"], // Path to API docs
};

export const swaggerSpec = swaggerJsdoc(options);
