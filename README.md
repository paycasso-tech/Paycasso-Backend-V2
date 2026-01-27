# Paycasso Backend V2

This backend handles Web3 interactions (Coinbase integration), Disputes, and User management.

## API Documentation

The API documentation is available via Swagger UI.

1. Start the server:
   ```bash
   npm run dev
   ```
2. Visit: `http://localhost:3001/api-docs`

## Endpoints Overview

- **User**: Register, Login, Get Wallet Info.
- **Transfer**: Create and view transfers (USDC on Base).
- **Dispute**: Create jobs, disputes, voting, and resolution.

## Environment Variables

Ensure `.env` is configured with:
- `DATABASE_URL`
- `PORT` (default 3001)
- `COINBASE_API_KEY_NAME` / `COINBASE_API_KEY_PRIVATE_KEY` (if using env content) or `cdp_api_key.json` file.