-- CreateTable
CREATE TABLE `MedicalAttachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileName` VARCHAR(191) NOT NULL,
    `storedName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recordId` INTEGER NOT NULL,

    UNIQUE INDEX `MedicalAttachment_storedName_key`(`storedName`),
    INDEX `MedicalAttachment_recordId_idx`(`recordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MedicalAttachment` ADD CONSTRAINT `MedicalAttachment_recordId_fkey` FOREIGN KEY (`recordId`) REFERENCES `MedicalRecord`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
