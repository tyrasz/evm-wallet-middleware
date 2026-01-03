
import { WalletService } from '../src/services/wallet.service';
import { PrismaClient } from '@prisma/client';
import { CryptoService } from '../src/services/crypto.service';
import { AuditService } from '../src/services/audit.service';
import { PolicyService } from '../src/services/policy.service';
import { WebhookService } from '../src/services/webhook.service';

const prisma = new PrismaClient();
const cryptoService = new CryptoService();
const auditService = new AuditService(prisma);
const policyService = new PolicyService(prisma);
const webhookService = new WebhookService(prisma);

const walletService = new WalletService(prisma, auditService, policyService, webhookService);

async function main() {
    const mnemonic = "test test test test test test test test test test test junk";
    console.log("Testing Mnemonic:", mnemonic);

    try {
        const wallet = await walletService.createWallet("Mnemonic Test", "DebugScript", undefined, mnemonic);
        console.log("Wallet Created:", wallet);
        console.log("Expected Address (Account 0): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"); // Standard Hardhat/Foundry mnemonic address

        if (wallet.address.toLowerCase() === "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase()) {
            console.log("SUCCESS: Address matches.");
        } else {
            console.error("FAILURE: Address mismatch.");
        }

        // Test Signing Retrieval
        const signer = await walletService.getSigner(wallet.address);
        console.log("Signer Retrieved:", signer.address);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
