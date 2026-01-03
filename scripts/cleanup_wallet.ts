
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    try {
        const deleted = await prisma.wallet.delete({
            where: { address }
        });
        console.log("Deleted wallet:", deleted.address);
    } catch (e) {
        console.log("Wallet not found or error:", (e as Error).message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
