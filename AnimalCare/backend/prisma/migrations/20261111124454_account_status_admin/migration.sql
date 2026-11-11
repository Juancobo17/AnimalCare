-- AlterTable
ALTER TABLE `User` ADD COLUMN `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED') NOT NULL DEFAULT 'ACTIVE',
    MODIFY `role` ENUM('CLIENT', 'VETERINARIAN', 'ADMIN') NOT NULL DEFAULT 'CLIENT';

-- Las cuentas que ya existian quedan ACTIVE (valor por defecto) para no
-- bloquear a nadie con la migracion. Desde ahora, los veterinarios nuevos
-- se registran como PENDING hasta que el administrador los apruebe (AN-35).
