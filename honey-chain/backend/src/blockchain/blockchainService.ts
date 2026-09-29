import { ethers, Contract, Wallet, JsonRpcProvider } from 'ethers';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { hashBatch } from '../utils/helpers';

// ABI for HoneyChain.sol — only the functions we use
const HONEY_CHAIN_ABI = [
  'function registerBatch(bytes32 _publicBatchId, bytes32 _batchHash) external',
  'function addBatchEvent(bytes32 _publicBatchId, bytes32 _eventHash, string calldata _eventType, uint256 _eventAt) external',
  'function verifyBatch(bytes32 _publicBatchId, bytes32 _hashToVerify) external view returns (bool isRegistered, bool hashMatches, uint256 registeredAt, bytes32 storedHash)',
  'function getBatch(bytes32 _publicBatchId) external view returns (bytes32 batchHash, uint256 registeredAt, address registeredBy, bool exists)',
  'function getBatchEventCount(bytes32 _publicBatchId) external view returns (uint256)',
  'function transferBatch(bytes32 _publicBatchId, string calldata _transferEventHash, uint256 _transferAt) external',
  'event BatchRegistered(bytes32 indexed publicBatchId, bytes32 batchHash, address registeredBy, uint256 timestamp)',
  'event BatchEventAdded(bytes32 indexed publicBatchId, bytes32 eventHash, string eventType, uint256 eventAt)',
];

export class BlockchainService {
  private provider: JsonRpcProvider | null = null;
  private wallet: Wallet | null = null;
  private contract: Contract | null = null;
  private isConnected = false;

  async initialize(): Promise<void> {
    if (!config.blockchain.rpcUrl) {
      logger.warn('Blockchain RPC URL not configured — blockchain features unavailable');
      return;
    }

    try {
      this.provider = new JsonRpcProvider(config.blockchain.rpcUrl);
      await this.provider.getNetwork(); // Test connection

      if (!config.blockchain.privateKey) {
        logger.warn('Blockchain private key not configured — read-only mode');
        this.isConnected = true;
        return;
      }

      this.wallet = new Wallet(config.blockchain.privateKey, this.provider);

      if (config.blockchain.contractAddress) {
        this.contract = new Contract(
          config.blockchain.contractAddress,
          HONEY_CHAIN_ABI,
          this.wallet
        );
        logger.info('Blockchain service initialized', {
          rpcUrl: config.blockchain.rpcUrl,
          contractAddress: config.blockchain.contractAddress,
        });
      } else {
        logger.warn('Smart contract address not configured — deploy contract first');
      }

      this.isConnected = true;
    } catch (error) {
      logger.error('Failed to initialize blockchain service', { error });
      this.isConnected = false;
    }
  }

  get available(): boolean {
    return this.isConnected && this.contract !== null;
  }

  /**
   * Convert a public batch ID string to bytes32
   */
  private toBytes32(str: string): string {
    return ethers.encodeBytes32String(str.substring(0, 31)); // bytes32 = 32 bytes
  }

  /**
   * Convert a hex hash string to bytes32
   */
  private hexToBytes32(hexHash: string): string {
    if (hexHash.startsWith('0x')) return hexHash;
    return '0x' + hexHash;
  }

  /**
   * Register a batch on-chain.
   * Stores only the hash of the batch canonical data, not the actual data.
   */
  async registerBatch(batchId: string): Promise<{
    success: boolean;
    txHash?: string;
    blockNumber?: number;
    error?: string;
  }> {
    if (!this.available) {
      return { success: false, error: 'Blockchain service not available' };
    }

    try {
      const batch = await prisma.honeyBatch.findUnique({ where: { id: batchId } });
      if (!batch) return { success: false, error: 'Batch not found' };

      const batchHash = hashBatch(batch);
      const publicBatchIdBytes32 = this.toBytes32(batch.publicBatchId);
      const batchHashBytes32 = this.hexToBytes32(batchHash);

      // Check if already registered
      const [, , , alreadyExists] = await (this.contract as Contract).getBatch(publicBatchIdBytes32);
      if (alreadyExists) {
        return { success: false, error: 'Batch already registered on blockchain' };
      }

      const tx = await (this.contract as Contract).registerBatch(publicBatchIdBytes32, batchHashBytes32);
      const receipt = await tx.wait();

      // Update blockchain record in DB
      await prisma.blockchainRecord.upsert({
        where: { batchId },
        create: {
          batchId,
          publicBatchId: batch.publicBatchId,
          batchHash,
          registrationTxHash: receipt.hash,
          registrationBlock: receipt.blockNumber,
          registrationAt: new Date(),
          networkId: config.blockchain.networkId,
          contractAddress: config.blockchain.contractAddress,
          status: 'CONFIRMED',
        },
        update: {
          batchHash,
          registrationTxHash: receipt.hash,
          registrationBlock: receipt.blockNumber,
          registrationAt: new Date(),
          status: 'CONFIRMED',
        },
      });

      logger.info('Batch registered on blockchain', {
        batchId,
        publicBatchId: batch.publicBatchId,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return { success: true, txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Blockchain transaction failed';
      logger.error('Blockchain registerBatch failed', { batchId, error: message });

      // Mark as failed in DB
      await prisma.blockchainRecord.updateMany({
        where: { batchId },
        data: { status: 'FAILED', errorMessage: message },
      });

      return { success: false, error: message };
    }
  }

  /**
   * Verify a batch against the blockchain.
   * Recalculates the hash from DB and compares with on-chain hash.
   */
  async verifyBatch(batchId: string): Promise<{
    isRegistered: boolean;
    hashMatches: boolean;
    verificationResult: 'VERIFIED' | 'HASH_MISMATCH' | 'NOT_REGISTERED' | 'SERVICE_UNAVAILABLE';
    txHash?: string;
    registeredAt?: Date;
    onChainHash?: string;
    computedHash?: string;
  }> {
    if (!this.available) {
      return {
        isRegistered: false,
        hashMatches: false,
        verificationResult: 'SERVICE_UNAVAILABLE',
      };
    }

    try {
      const batch = await prisma.honeyBatch.findUnique({ where: { id: batchId } });
      if (!batch) {
        return { isRegistered: false, hashMatches: false, verificationResult: 'NOT_REGISTERED' };
      }

      const computedHash = hashBatch(batch);
      const publicBatchIdBytes32 = this.toBytes32(batch.publicBatchId);
      const computedHashBytes32 = this.hexToBytes32(computedHash);

      const [isRegistered, hashMatches, registeredAtBN, storedHash] =
        await (this.contract as Contract).verifyBatch(publicBatchIdBytes32, computedHashBytes32);

      // Update verification stats
      const blockchainRecord = await prisma.blockchainRecord.findUnique({ where: { batchId } });
      if (blockchainRecord) {
        await prisma.blockchainRecord.update({
          where: { batchId },
          data: {
            verificationCount: { increment: 1 },
            lastVerifiedAt: new Date(),
          },
        });
      }

      return {
        isRegistered,
        hashMatches,
        verificationResult: !isRegistered
          ? 'NOT_REGISTERED'
          : hashMatches
          ? 'VERIFIED'
          : 'HASH_MISMATCH',
        registeredAt: isRegistered ? new Date(Number(registeredAtBN) * 1000) : undefined,
        onChainHash: storedHash,
        computedHash,
      };
    } catch (error) {
      logger.error('Blockchain verifyBatch failed', { batchId, error });
      return {
        isRegistered: false,
        hashMatches: false,
        verificationResult: 'SERVICE_UNAVAILABLE',
      };
    }
  }

  /**
   * Add a batch event to the blockchain (append-only).
   */
  async addBatchEvent(
    publicBatchId: string,
    eventHash: string,
    eventType: string,
    eventAt: Date
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.available) {
      return { success: false, error: 'Blockchain service not available' };
    }

    try {
      const publicBatchIdBytes32 = this.toBytes32(publicBatchId);
      const eventHashBytes32 = this.hexToBytes32(eventHash);
      const eventTimestamp = Math.floor(eventAt.getTime() / 1000);

      const tx = await (this.contract as Contract).addBatchEvent(
        publicBatchIdBytes32,
        eventHashBytes32,
        eventType,
        eventTimestamp
      );
      const receipt = await tx.wait();

      return { success: true, txHash: receipt.hash };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add event to blockchain';
      logger.error('Blockchain addBatchEvent failed', { publicBatchId, eventType, error: message });
      return { success: false, error: message };
    }
  }

  async getNetworkInfo(): Promise<{
    connected: boolean;
    network?: { chainId: number; name: string };
    blockNumber?: number;
    contractAddress?: string;
  }> {
    if (!this.provider) {
      return { connected: false };
    }

    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      return {
        connected: true,
        network: { chainId: Number(network.chainId), name: network.name },
        blockNumber,
        contractAddress: config.blockchain.contractAddress || undefined,
      };
    } catch {
      return { connected: false };
    }
  }
}

// Singleton instance
export const blockchainService = new BlockchainService();
