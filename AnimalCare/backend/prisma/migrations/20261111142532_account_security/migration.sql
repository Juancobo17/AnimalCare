-- AlterTable
ALTER TABLE `User` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `privacyAcceptedAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'DELETED') NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE `AuthToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tokenHash` VARCHAR(191) NOT NULL,
    `purpose` ENUM('PASSWORD_RESET', 'EMAIL_VERIFICATION') NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `AuthToken_tokenHash_key`(`tokenHash`),
    INDEX `AuthToken_userId_purpose_idx`(`userId`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuthToken` ADD CONSTRAINT `AuthToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
