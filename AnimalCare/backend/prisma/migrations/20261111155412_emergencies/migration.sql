-- AlterTable
ALTER TABLE `VetProfile` ADD COLUMN `emergencyUntil` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `EmergencyRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `symptoms` TEXT NOT NULL,
    `mode` ENUM('HOME', 'CLINIC') NOT NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'ACCEPTED', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acceptedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `clientId` INTEGER NOT NULL,
    `petId` INTEGER NULL,
    `vetProfileId` INTEGER NULL,

    INDEX `EmergencyRequest_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `EmergencyRequest_clientId_idx`(`clientId`),
    INDEX `EmergencyRequest_vetProfileId_status_idx`(`vetProfileId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmergencyRequest` ADD CONSTRAINT `EmergencyRequest_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmergencyRequest` ADD CONSTRAINT `EmergencyRequest_petId_fkey` FOREIGN KEY (`petId`) REFERENCES `Pet`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmergencyRequest` ADD CONSTRAINT `EmergencyRequest_vetProfileId_fkey` FOREIGN KEY (`vetProfileId`) REFERENCES `VetProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
