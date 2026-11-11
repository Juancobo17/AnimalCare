-- AlterTable
ALTER TABLE `Appointment` ADD COLUMN `petId` INTEGER NULL,
    ADD COLUMN `reminderSentAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `VetProfile` ADD COLUMN `licenseDocPath` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Review` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rating` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `appointmentId` INTEGER NOT NULL,
    `clientId` INTEGER NOT NULL,
    `vetProfileId` INTEGER NOT NULL,

    UNIQUE INDEX `Review_appointmentId_key`(`appointmentId`),
    INDEX `Review_vetProfileId_createdAt_idx`(`vetProfileId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_petId_fkey` FOREIGN KEY (`petId`) REFERENCES `Pet`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_vetProfileId_fkey` FOREIGN KEY (`vetProfileId`) REFERENCES `VetProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
