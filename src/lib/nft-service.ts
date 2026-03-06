/**
 * NFT Minting Service
 * Handles IPFS uploads, metadata generation, and blockchain minting
 */

import { pinFile, pinJSON } from "./pinata-config";
import { prisma } from "@/lib/prisma-client";
import type { Prisma } from "@prisma/client";
import { GENESIS_PIONEER_METADATA_URI } from "@/lib/genesis-assets";
import { generateCertificateSVG } from "@/lib/certificate-generator";
import {
  getContractAddress,
  AMOY_CHAIN_ID,
  NFT_CONTRACT_ABI,
  getExplorerTxUrl,
} from "@/lib/contracts";
import {
  getDeployerAddress,
  getPublicClient,
  getWalletClient,
  getDeployerAccount,
  isOnChainEnabled,
} from "@/lib/viem-client";
import { encodeFunctionData } from "viem";
import { logger } from "@/lib/monitoring";
import fs from "fs";
import path from "path";

// Log on-chain mode at module load
if (typeof globalThis !== 'undefined' && typeof process !== 'undefined') {
  const mode = isOnChainEnabled() ? 'REAL (Polygon Amoy)' : 'MOCK (dev fallback)';
  logger.info(`NFT Service initialized — on-chain mode: ${mode}`, "nft-service");
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  courseSlug?: string;
  courseName?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
  animation_url?: string;
}

export interface MintNFTParams {
  userId: string;
  ensName?: string;
  userAddress?: string;
}

/**
 * Upload image to IPFS via Pinata
 */
export async function uploadImageToIPFS(
  imageBuffer: Buffer,
  filename: string
): Promise<string> {
  try {
    // Convert Buffer to File for Pinata upload
    const arrayBuffer = imageBuffer.buffer.slice(
      imageBuffer.byteOffset,
      imageBuffer.byteOffset + imageBuffer.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: "image/png" });
    const file = new File([blob], filename, { type: "image/png" });
    
    return await pinFile(file);
  } catch {
    throw new Error("Failed to upload image to IPFS");
  }
}

/**
 * Upload metadata JSON to IPFS
 */
import { env } from '@/env';

export async function uploadMetadataToIPFS(
  metadata: NFTMetadata
): Promise<string> {
  // IPFS-first: prefer Pinata when configured. If missing, provide a dev fallback.
  if (!env.PINATA_JWT) {
    if (env.NODE_ENV === 'production') {
      throw new Error('Pinata not configured — PINATA_JWT is required in production');
    }

    // Development fallback: write metadata JSON to public/local-metadata
    try {
      const outDir = `${process.cwd()}/public/local-metadata`;
      const filename = `metadata-${Date.now()}.json`;
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(`${outDir}/${filename}`, JSON.stringify(metadata, null, 2));
      logger.warn(`Saved metadata to /local-metadata/${filename} (Pinata not configured)`, "nft-service");
      return `/local-metadata/${filename}`;
    } catch {
      throw new Error('Failed to write local metadata fallback');
    }
  }

  try {
    return await pinJSON(metadata as unknown as Record<string, unknown>);
  } catch {
    // If Pinata fails in dev, fallback to local file; in prod propagate error
    if (env.NODE_ENV !== 'production') {
      try {
        const outDir = `${process.cwd()}/public/local-metadata`;
        const filename = `metadata-${Date.now()}.json`;
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(`${outDir}/${filename}`, JSON.stringify(metadata, null, 2));
        logger.warn(`Pinata upload failed, saved to /local-metadata/${filename}`, "nft-service");
        return `/local-metadata/${filename}`;
      } catch {
        // fall through
      }
    }

    throw new Error('Failed to upload metadata to IPFS');
  }
}

/**
 * Generate NFT metadata for Genesis Scholar
 */
export function generateGenesisScholarMetadata(
  imageUri: string,
  ensName?: string
): NFTMetadata {
  return {
    name: ensName ? `EIPsInsight Academy Pioneer - ${ensName}` : "EIPsInsight Academy Pioneer NFT",
    description: `Commemorates ${ensName || 'a dedicated scholar'} being an early EIPsInsight Academy pioneer and completing the onboarding journey.`,
    image: imageUri,
    attributes: [
      { trait_type: "Type", value: "Genesis Scholar" },
      { trait_type: "Edition", value: "Pioneer" },
      { trait_type: "Rarity", value: "Founder" },
      { trait_type: "Minted Date", value: new Date().toISOString().split("T")[0] },
      ...(ensName ? [{ trait_type: "ENS Name", value: ensName }] : []),
    ],
    external_url: "https://academy.eipsinsight.com",
  };
}

/**
 * Mint NFT on blockchain and save to database
 */
export async function mintNFTAndSave(
  params: MintNFTParams
): Promise<{ id: string; tokenId: string; metadataUri: string }> {
  try {
    const { userId, ensName, userAddress } = params;

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Generate a unique SVG Pioneer certificate for this recipient
    const certSvg = generateCertificateSVG({
      type: "pioneer",
      recipientName: ensName || user.name || "Pioneer",
      walletAddress: userAddress,
      completionDate: new Date().toISOString(),
    });
    const imageUri = await uploadCertificateToIPFS(certSvg, `pioneer-${userId}-${Date.now()}.svg`);

    // Generate metadata referencing the unique certificate image
    const metadata = generateGenesisScholarMetadata(imageUri, ensName);

    // Upload metadata to IPFS
    const metadataUri = await uploadMetadataToIPFS(metadata);

    // Mint on-chain only if the user has a real wallet address
    let tokenId: string;
    let txHash: string | null = null;
    let contractAddr: string | null = null;

    if (userAddress && isOnChainEnabled()) {
      const mintResult = await mintOnChain(userAddress, metadataUri, "pioneer");
      tokenId = mintResult.tokenId;
      txHash = mintResult.txHash;
      contractAddr = mintResult.contractAddress;
    } else {
      // Off-chain record only (no wallet connected or on-chain disabled)
      tokenId = `off-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      txHash = null; // no real transaction
      contractAddr = null;
    }

    // Save NFT record to database
    const nft = await prisma.nFT.create({
      data: {
        userId,
        name: `EIPsInsight Academy Genesis Pioneer - ${ensName || user.name || "Scholar"}`,
        image: imageUri,
        metadata: metadataUri,
        contractAddress: contractAddr,
        tokenId,
        chainId: AMOY_CHAIN_ID,
        ownerAddress: userAddress || null,
        transactionHash: txHash,
        mintedAt: new Date(),
      },
    });

    return {
      id: nft.id,
      tokenId: nft.tokenId,
      metadataUri,
    };
  } catch (error) {
    throw new Error(`NFT minting failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get user's NFTs
 */
export async function getUserNFTs(userId: string) {
  try {
    return await prisma.nFT.findMany({
      where: { userId },
      orderBy: { mintedAt: "desc" },
    });
  } catch (error) {
    throw new Error(`Failed to fetch NFTs: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
export async function mintOnChain(
  recipientAddress: string,
  metadataUri: string,
  _nftType: "pioneer" | "course-completion"
): Promise<{ tokenId: string; txHash: string; contractAddress: string }> {
  void _nftType;
  const contractAddress = getContractAddress(AMOY_CHAIN_ID, "NFT_CONTRACT") as `0x${string}`;

  // If on-chain operations are not available, fall back to mock (dev only)
  if (!isOnChainEnabled()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("On-chain minting unavailable: AMOY_RPC_URL and DEPLOYER_PRIVATE_KEY must be set.");
    }
    logger.warn("On-chain minting disabled (missing env vars) — using dev mock", "nft-service");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const mockTokenId = `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    // Return empty txHash so callers know this wasn't a real on-chain mint
    return { tokenId: mockTokenId, txHash: "", contractAddress };
  }

  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const deployerAccount = getDeployerAccount();

  logger.info(`Minting NFT to ${recipientAddress}`, "nft-service", { metadataUri });

  try {
    logger.info(`Using contract address: ${contractAddress}`, "nft-service");
    logger.info(`Deployer address: ${deployerAccount.address}`, "nft-service");
    
    // Encode the contract call data
    const encodedData = encodeFunctionData({
      abi: NFT_CONTRACT_ABI,
      functionName: "mint",
      args: [recipientAddress as `0x${string}`, metadataUri],
    });

    // Get current nonce
    const nonce = await publicClient.getTransactionCount({
      address: deployerAccount.address,
    });

    // Estimate gas
    const gasEstimate = await publicClient.estimateGas({
      account: deployerAccount,
      to: contractAddress,
      data: encodedData,
    });

    // Get gas price
    const gasPrice = await publicClient.getGasPrice();

    // Build the transaction
    const tx = {
      account: deployerAccount,
      to: contractAddress as `0x${string}`,
      data: encodedData,
      nonce,
      gasPrice,
      gas: gasEstimate + BigInt(10000), // Add small buffer
      chainId: AMOY_CHAIN_ID,
    };

    logger.info(`Built transaction`, "nft-service", { nonce, gasPrice: gasPrice.toString(), gas: (gasEstimate + BigInt(10000)).toString() });

    // Sign the transaction
    const serialized = await walletClient.signTransaction(tx);

    // Send the raw transaction
    const txHash = await publicClient.sendRawTransaction({
      serializedTransaction: serialized,
    });

    logger.info(`Mint tx sent: ${txHash}`, "nft-service");

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === "reverted") {
      throw new Error(`Mint transaction reverted: ${txHash}`);
    }

    // Try to extract the tokenId from the Minted event log
    let tokenId = `${Date.now()}`;
    try {
      for (const log of receipt.logs) {
        try {
          // The Minted event has indexed `to` and indexed `tokenId`
          if (log.topics.length >= 3) {
            // tokenId is the second indexed param (topics[2])
            const raw = BigInt(log.topics[2]!);
            tokenId = raw.toString();
            break;
          }
        } catch {
          // Not our event, continue
        }
      }
    } catch {
      // Fallback tokenId is fine
    }

    logger.info(`Mint confirmed: tokenId=${tokenId}, tx=${txHash}`, "nft-service");

    return {
      tokenId,
      txHash,
      contractAddress,
    };
  } catch (error) {
    logger.error(
      "On-chain mint failed",
      "nft-service",
      { recipientAddress, metadataUri, contractAddress, deployerAddress: deployerAccount.address },
      error
    );
    
    // Get more detailed error info
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
      // If it's a Viem error with details, include them
      if ((error as any).details) {
        errorMessage += ` | Details: ${(error as any).details}`;
      }
      if ((error as any).code) {
        errorMessage += ` | Code: ${(error as any).code}`;
      }
    }
    
    throw new Error(
      `On-chain mint failed: ${errorMessage}`
    );
  }
}

/**
 * Save NFT to database
 */
export async function saveNFTToDatabase(params: {
  userId: string;
  tokenId: string;
  name: string;
  image: string;
  metadata: NFTMetadata;
  contractAddress?: string;
  transactionHash?: string;
  ownerAddress?: string;
  chainId?: number;
}) {
  return await prisma.nFT.create({
    data: {
      userId: params.userId,
      tokenId: params.tokenId,
      name: params.name,
      image: params.image,
      metadata: params.metadata as unknown as Prisma.InputJsonValue,
      contractAddress: params.contractAddress ?? null,
      transactionHash: params.transactionHash ?? null,
      ownerAddress: params.ownerAddress ?? null,
      chainId: params.chainId ?? AMOY_CHAIN_ID,
      mintedAt: new Date(),
    },
  });
}

/**
 * Full minting pipeline: upload to IPFS, mint on-chain, save to DB
 */
export async function mintGenesisNFTs(params: MintNFTParams) {
  const { userId, ensName, userAddress } = params;

  // Generate a unique SVG Pioneer certificate for this recipient
  const pioneerSvgBuffer = generateCertificateSVG({
    type: "pioneer",
    recipientName: ensName || "Pioneer",
    walletAddress: userAddress,
    completionDate: new Date().toISOString(),
  });
  const pioneerFilename = `pioneer-${Date.now()}.svg`;
  const genesisImageUri = await uploadCertificateToIPFS(pioneerSvgBuffer, pioneerFilename);

  // Generate metadata (reference unique SVG)
  const genesisMetadata = generateGenesisScholarMetadata(genesisImageUri, ensName);

  const genesisMetadataUri = GENESIS_PIONEER_METADATA_URI
    ? GENESIS_PIONEER_METADATA_URI
    : await uploadMetadataToIPFS(genesisMetadata);

  // Mint on-chain only if the user has a real wallet address
  let genesisResult: { tokenId: string; txHash: string; contractAddress: string };

  if (userAddress && isOnChainEnabled()) {
    genesisResult = await mintOnChain(userAddress, genesisMetadataUri, "pioneer");
  } else {
    // Off-chain record only (no wallet connected or on-chain disabled)
    genesisResult = {
      tokenId: `off-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      txHash: "",
      contractAddress: "",
    };
  }

  // Save to database with on-chain data (null for off-chain mints)
  const genesisNFT = await saveNFTToDatabase({
    userId,
    tokenId: genesisResult.tokenId,
    name: "EIPsInsight Academy Pioneer NFT",
    image: genesisImageUri,
    metadata: genesisMetadata,
    contractAddress: genesisResult.contractAddress || undefined,
    transactionHash: genesisResult.txHash || undefined,
    ownerAddress: userAddress || undefined,
    chainId: AMOY_CHAIN_ID,
  });

  const explorerUrl = genesisResult.txHash && genesisResult.txHash.length > 2
    ? getExplorerTxUrl(AMOY_CHAIN_ID, genesisResult.txHash)
    : null;

  return {
    nfts: [genesisNFT],
    transactions: [
      {
        type: "pioneer",
        txHash: genesisResult.txHash,
        tokenId: genesisResult.tokenId,
        explorerUrl,
      },
    ],
  };
}

/**
 * Upload a generated SVG certificate Buffer to IPFS via Pinata.
 *
 * Falls back to a local file path in development when Pinata is not configured,
 * exactly like the existing metadata upload path.
 */
export async function uploadCertificateToIPFS(
  svgBuffer: Buffer,
  filename: string
): Promise<string> {
  if (!env.PINATA_JWT) {
    if (env.NODE_ENV === "production") {
      throw new Error("Pinata not configured — PINATA_JWT is required in production");
    }
    // Dev fallback: persist SVG alongside local metadata
    try {
      const outDir = path.join(process.cwd(), "public", "local-metadata");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, filename);
      fs.writeFileSync(outPath, svgBuffer);
      logger.warn(`Saved certificate SVG to /local-metadata/${filename} (Pinata not configured)`, "nft-service");
      return `/local-metadata/${filename}`;
    } catch {
      throw new Error("Failed to write local certificate fallback");
    }
  }

  try {
    const file = new File([new Uint8Array(svgBuffer)], filename, { type: "image/svg+xml" });
    return await pinFile(file);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (env.NODE_ENV !== "production") {
      // Dev: fall back to local file
      try {
        const outDir = path.join(process.cwd(), "public", "local-metadata");
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, filename);
        fs.writeFileSync(outPath, svgBuffer);
        logger.warn(`Pinata upload failed, saved certificate to /local-metadata/${filename}: ${msg}`, "nft-service");
        return `/local-metadata/${filename}`;
      } catch {
        // fall through
      }
    }
    throw new Error(`Failed to upload certificate to IPFS: ${msg}`);
  }
}

/**
 * Generate NFT metadata for course completion
 */
export function generateCourseCompletionMetadata(
  imageUri: string,
  courseName: string,
  courseSlug: string,
  recipientName?: string,
  courseLevel?: string
): NFTMetadata {
  const recipient = recipientName || "Scholar";
  return {
    name: `${courseName} — ${recipient}`,
    description: `On-chain certificate of completion for ${courseName} on EIPsInsight Academy, awarded to ${recipient}. This unique certificate is generated specifically for this recipient and is permanently recorded on the blockchain.`,
    image: imageUri,
    courseSlug,
    courseName,
    attributes: [
      { trait_type: "Type", value: "Course Completion" },
      { trait_type: "Course", value: courseName },
      { trait_type: "Course Slug", value: courseSlug },
      { trait_type: "Recipient", value: recipient },
      { trait_type: "Platform", value: "EIPsInsight Academy" },
      { trait_type: "Level", value: courseLevel || "Beginner" },
      { trait_type: "Completion Date", value: new Date().toISOString().split("T")[0] },
      { trait_type: "Certificate Type", value: "Unique On-Chain SVG" },
    ],
    external_url: `https://academy.eipsinsight.com/courses/${courseSlug}`,
  };
}

/**
 * Mint course completion NFT with Learning Sprout design
 */
export async function mintCourseCompletionNFT(params: {
  userId: string;
  courseSlug: string;
  courseName: string;
  userAddress?: string;
  recipientName?: string;
  courseLevel?: string;
}) {
  const { userId, courseSlug, courseName, userAddress, recipientName, courseLevel } = params;

  // --- Generate a unique SVG certificate for this recipient ---
  const certSvgBuffer = generateCertificateSVG({
    type: "course-completion",
    recipientName: recipientName || "Scholar",
    walletAddress: userAddress,
    courseName,
    courseSlug,
    completionDate: new Date().toISOString(),
    courseLevel,
  });

  // Upload SVG certificate image to IPFS
  const certFilename = `cert-${courseSlug}-${Date.now()}.svg`;
  const imageUri = await uploadCertificateToIPFS(certSvgBuffer, certFilename);

  // Generate metadata (now references the unique SVG image)
  const metadata = generateCourseCompletionMetadata(
    imageUri, courseName, courseSlug, recipientName, courseLevel
  );

  // Upload metadata to IPFS
  const metadataUri = await uploadMetadataToIPFS(metadata);

  // Mint on-chain only if the user has a real wallet address
  let mintResult: { tokenId: string; txHash: string; contractAddress: string };

  if (userAddress && isOnChainEnabled()) {
    mintResult = await mintOnChain(userAddress, metadataUri, "course-completion");
  } else {
    mintResult = {
      tokenId: `off-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      txHash: "",
      contractAddress: "",
    };
  }

  // Update SVG with minted tokenId so the serial number is accurate
  const finalCertBuffer = generateCertificateSVG({
    type: "course-completion",
    recipientName: recipientName || "Scholar",
    walletAddress: userAddress,
    courseName,
    courseSlug,
    completionDate: new Date().toISOString(),
    courseLevel,
    serialNumber: mintResult.tokenId,
  });
  const finalFilename = `cert-${courseSlug}-${mintResult.tokenId.slice(0, 12)}.svg`;
  const finalImageUri = await uploadCertificateToIPFS(finalCertBuffer, finalFilename).catch(() => imageUri);

  // Save to database (null for off-chain mints so dashboard won't show invalid explorer links)
  const nft = await saveNFTToDatabase({
    userId,
    tokenId: mintResult.tokenId,
    name: `${courseName} — ${recipientName || "Scholar"}`,
    image: finalImageUri,
    metadata: { ...metadata, image: finalImageUri },
    contractAddress: mintResult.contractAddress || undefined,
    transactionHash: mintResult.txHash || undefined,
    ownerAddress: userAddress || undefined,
    chainId: AMOY_CHAIN_ID,
  });

  const explorerUrl =
    mintResult.txHash && mintResult.txHash.length > 2
      ? getExplorerTxUrl(AMOY_CHAIN_ID, mintResult.txHash)
      : null;

  return {
    nft,
    transaction: {
      type: "course-completion",
      txHash: mintResult.txHash,
      tokenId: mintResult.tokenId,
      courseSlug,
      courseName,
      explorerUrl,
    },
  };
}

/**
 * Synchronize user NFTs from the blockchain to the database
 */
export async function syncUserNFTs(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallets: true },
  });

  if (!user || user.wallets.length === 0) {
    return { success: true, synced: 0, message: "No wallets found for user" };
  }

  const publicClient = getPublicClient();
  // specify chain and ensure the returned string is treated as an address literal
  const contractAddress = getContractAddress(AMOY_CHAIN_ID, "NFT_CONTRACT") as `0x${string}`;
  
  if (!contractAddress) {
    return { success: false, error: "NFT contract address not configured" };
  }

  let syncedCount = 0;
  
  for (const wallet of user.wallets) {
    const address = wallet.address as `0x${string}`;
    
    try {
      // Find all Minted events for this user
      const logs = await publicClient.getLogs({
        address: contractAddress,
        event: {
          type: "event",
          name: "Minted",
          inputs: [
            { indexed: true, name: "to", type: "address" },
            { indexed: true, name: "tokenId", type: "uint256" },
          ],
        },
        args: { to: address },
        fromBlock: BigInt(0), // Start from genesis for Amoy
      });

      for (const log of logs) {
        const tokenIdInt = log.args.tokenId;
        if (tokenIdInt === undefined) continue;
        const tokenId = tokenIdInt.toString();

        // Check if we already have this NFT by tokenId and contractAddress
        const existing = await prisma.nFT.findFirst({
          where: { 
            tokenId, 
            contractAddress: contractAddress,
            chainId: AMOY_CHAIN_ID
          },
        });

        if (!existing) {
          // Fetch TokenURI
          try {
            const tokenUri = await publicClient.readContract({
              address: contractAddress,
              abi: NFT_CONTRACT_ABI,
              functionName: "tokenURI",
              args: [tokenIdInt],
            }) as string;

            // Fetch metadata JSON
            let metadata: NFTMetadata;
            if (tokenUri.startsWith('ipfs://')) {
              const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${tokenUri.replace('ipfs://', '')}`;
              const metadataRes = await fetch(gatewayUrl);
              if (!metadataRes.ok) throw new Error(`HTTP ${metadataRes.status} fetching metadata`);
              metadata = await metadataRes.json() as NFTMetadata;
            } else if (tokenUri.startsWith('/local-metadata/')) {
              // Read local file from public/local-metadata
              const localPath = path.join(process.cwd(), 'public', tokenUri);
              if (fs.existsSync(localPath)) {
                metadata = JSON.parse(fs.readFileSync(localPath, 'utf8')) as NFTMetadata;
              } else {
                throw new Error(`Local metadata file not found: ${localPath}`);
              }
            } else {
              // External URL
              const metadataRes = await fetch(tokenUri);
              if (!metadataRes.ok) throw new Error(`HTTP ${metadataRes.status} fetching metadata`);
              metadata = await metadataRes.json() as NFTMetadata;
            }

            // Save to DB
            await prisma.nFT.create({
              data: {
                userId,
                tokenId,
                name: metadata.name || `EIPsInsight Academy Certificate #${tokenId}`,
                image: metadata.image || "",
                metadata: metadata as unknown as Prisma.InputJsonValue,
                contractAddress,
                chainId: AMOY_CHAIN_ID,
                ownerAddress: address,
                transactionHash: log.transactionHash,
              }
            });
            syncedCount++;
          } catch (err) {
            logger.error(`Failed to sync NFT ${tokenId}: ${err}`, "nft-service");
          }
        }
      }
    } catch (err) {
      logger.error(`Log fetch failed for ${address}: ${err}`, "nft-service");
    }
  }

  return { success: true, synced: syncedCount };
}
