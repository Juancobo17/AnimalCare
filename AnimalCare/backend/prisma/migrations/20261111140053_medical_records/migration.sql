-- CreateTable
CREATE TABLE `MedicalRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitDate` DATETIME(3) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `diagnosis` TEXT NOT NULL,
    `treatment` TEXT NULL,
    `weight` DECIMAL(6, 2) NULL,
    `temperature` DECIMAL(4, 1) NULL,
    `vaccines` TEXT NULL,
    `observations` TEXT NULL,
    `status` ENUM('ACTIVE', 'ANNULLED') NOT NULL DEFAULT 'ACTIVE',
    `annulReason` VARCHAR(191) NULL,
    `annulledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `petId` INTEGER NOT NULL,
    `vetProfileId` INTEGER NOT NULL,
    `appointmentId` INTEGER NULL,

    UNIQUE INDEX `MedicalRecord_appointmentId_key`(`appointmentId`),
    INDEX `MedicalRecord_petId_visitDate_idx`(`petId`, `visitDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MedicalRecord` ADD CONSTRAINT `MedicalRecord_petId_fkey` FOREIGN KEY (`petId`) REFERENCES `Pet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MedicalRecord` ADD CONSTRAINT `MedicalRecord_vetProfileId_fkey` FOREIGN KEY (`vetProfileId`) REFERENCES `VetProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MedicalRecord` ADD CONSTRAINT `MedicalRecord_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
