# EIPsInsight Academy Frontend

**Blockchain education made interactive, verifiable, and rewarding.** 

EIPsInsight Academy transforms Web3 learning with NFT achievements, AI tutoring, and gamified progress tracking.

## 🚀 What We've Built

### Interactive Experience
- **Global Grid System**: Full-viewport canvas with mouse-tracking glow effects inspired by Linear/Stripe/Vercel
- **Smart Content Detection**: Grid brightness adapts automatically over text for perfect readability
- **EIPsInsight Agent**: Bottom-right hover assistant with smooth animation cycles (p1→pause→p3→pause2)
- **Dialog Persistence**: Agent dialog stays open when clicking inside, closes when clicking outside

### Authentication & Infrastructure  
- **Better Auth**: Secure authentication with email verification
- **Prisma ORM**: Database schema with user management
- **Modern Stack**: Next.js 15, React 19, TypeScript, Tailwind CSS

### NFT Integration (In Progress)
- Asset preparation workflow (GIF + PNG preview → IPFS → metadata JSON)
- Minting infrastructure planning
- Founding Learner NFT concept ready for deployment

## 🎯 Current Goals

- [ ] Complete NFT minting integration with smart contracts
- [x] Wire up backend API for agent interactions
- [x] Fix build & type errors (local + CI)
- [ ] Deploy auth flows for user testing
- [ ] Finalize founding member NFT assets

## 🛠 Local Development

1. **Clone and install**
   ```bash
   git clone https://github.com/AyuShetty/eipsinsight-academy-frontend.git
   cd eipsinsight-academy-frontend
   pnpm install
   ```

2. **Database setup**
   ```bash
   pnpm prisma generate
   ```

3. **Environment variables**
   - Set up `.env` with auth keys (see `src/env.ts` for required variables)

4. **Start development**
   ```bash
   pnpm dev
   ```
   Visit [http://localhost:3000](http://localhost:3000)

## 📁 Key Components

- `src/components/GlobalGrid.tsx` - Interactive background system
- `src/components/AgentHover.tsx` - AI assistant with animations
- `src/app/(auth)/` - Authentication pages
- `src/app/(public)/` - Landing page and public content

## 🔧 Commands

```bash
pnpm dev              # Development server
pnpm build            # Production build  
pnpm lint             # Code linting
pnpm test             # Run Vitest suite
pnpm prisma studio    # Database GUI
pnpm deploy:amoy      # Deploy contracts to Amoy testnet
pnpm pin:genesis      # Pin Genesis NFT assets/metadata to Pinata (writes src/lib/genesis-assets.ts)
```

## 🧷 Pinning Genesis assets (Pinata)

- Set `PINATA_JWT` in `.env.local`.
- Run `pnpm pin:genesis` to upload the Genesis image + metadata template and update `src/lib/genesis-assets.ts` with the resulting `ipfs://` URIs.

> Dev note: if you haven't pinned assets, the app will fall back to a bundled local image (`/p1.gif`) so the UI and local mint flows remain functional without Pinata.

> ⚠️ Test / CI note: the test suite enforces that `PINATA_JWT` or a real `ipfs://` CID is present only for CI/production. Local development uses the bundled fallback image.

## 🚀 Deploying to Polygon Amoy Testnet

1. **Setup environment variables:**
   ```bash
   # Update .env.local with:
   AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
   DEPLOYER_PRIVATE_KEY=your-private-key-here
   ```

2. **Deploy contracts:**
   ```bash
   pnpm deploy:amoy
   ```

3. **Run smoke tests:**
   ```bash
   AMOY_RPC_URL=$(grep ^AMOY_RPC_URL .env.local | cut -d= -f2-) \
   DEPLOYER_PRIVATE_KEY=$(grep ^DEPLOYER_PRIVATE_KEY .env.local | cut -d= -f2-) \
   node scripts/smoke-amoy.mjs
   ```

## ✅ Post-Deploy Checklist

- [ ] Contracts deployed and verified on Amoy
- [ ] ENS subdomain registration working on-chain
- [ ] NFT minting functional and metadata on IPFS
- [ ] Frontend connected to deployed contract addresses
- [ ] Smoke tests passing end-to-end
- [ ] Environment secrets properly rotated and only in `.env.local`