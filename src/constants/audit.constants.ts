export enum AuditAction {
    WALLET_CREATE = 'WALLET_CREATE',
    TRANSACTION_SEND = 'TRANSACTION_SEND',
    ERC20_TRANSFER = 'ERC20_TRANSFER',
    CONTRACT_CALL = 'CONTRACT_CALL',
    MESSAGE_SIGN = 'MESSAGE_SIGN',
}

export enum AuditEntity {
    WALLET = 'Wallet',
    TRANSACTION = 'Transaction',
}
