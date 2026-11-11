-- AlterTable
ALTER TABLE `EmergencyRequest` ADD COLUMN `appointmentId` INTEGER NULL;

-- AlterTable
ALTER TABLE `VetProfile` DROP COLUMN `emergencyUntil`;

-- CreateIndex
CREATE UNIQUE INDEX `EmergencyRequest_appointmentId_key` ON `EmergencyRequest`(`appointmentId`);

-- AddForeignKey
ALTER TABLE `EmergencyRequest` ADD CONSTRAINT `EmergencyRequest_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

