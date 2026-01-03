import { decodeFunctionData, parseAbi, Hex, AbiItem } from 'viem';

export const ERC20_ABI = parseAbi([
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    'function mint(address to, uint256 amount)',
    'function burn(uint256 amount)'
]);

export class DecoderService {
    // Registry of known ABIs. In a real system, this might come from a DB or external API.
    private abis: AbiItem[] = [...ERC20_ABI] as AbiItem[];

    decodeData(data: string) {
        try {
            if (!data || data === '0x') return null;

            // Attempt to decode against known ABIs
            const decoded = decodeFunctionData({
                abi: this.abis,
                data: data as Hex
            });

            return {
                name: decoded.functionName,
                args: this.serializeArgs(decoded.args) // Serialize BigInts to strings
            };
        } catch (error) {
            // Decoding failed (function signature not found in our registry)
            return null;
        }
    }

    private serializeArgs(args: any): any {
        if (typeof args === 'bigint') {
            return args.toString();
        }
        if (Array.isArray(args)) {
            return args.map(arg => this.serializeArgs(arg));
        }
        if (typeof args === 'object' && args !== null) {
            const result: any = {};
            for (const key in args) {
                result[key] = this.serializeArgs(args[key]);
            }
            return result;
        }
        return args;
    }
}
