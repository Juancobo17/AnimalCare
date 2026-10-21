-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: animalcare
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Appointment`
--

DROP TABLE IF EXISTS `Appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Appointment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mode` enum('HOME','CLINIC') COLLATE utf8mb4_unicode_ci NOT NULL,
  `scheduledAt` datetime(3) NOT NULL,
  `durationMinutes` int NOT NULL,
  `address` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('PENDING','CONFIRMED','CANCELLED','COMPLETED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `clientId` int NOT NULL,
  `vetProfileId` int NOT NULL,
  `serviceId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Appointment_clientId_idx` (`clientId`),
  KEY `Appointment_vetProfileId_scheduledAt_idx` (`vetProfileId`,`scheduledAt`),
  KEY `Appointment_serviceId_fkey` (`serviceId`),
  CONSTRAINT `Appointment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Appointment_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Appointment_vetProfileId_fkey` FOREIGN KEY (`vetProfileId`) REFERENCES `VetProfile` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Appointment`
--

LOCK TABLES `Appointment` WRITE;
/*!40000 ALTER TABLE `Appointment` DISABLE KEYS */;
INSERT INTO `Appointment` VALUES (1,'CLINIC','2026-10-29 10:30:00.000',30,NULL,'fractura','PENDING','2026-10-14 21:37:54.775','2026-10-14 21:37:54.775',7,1,1),(2,'HOME','2026-10-21 10:00:00.000',30,'CARRERA 8 #10-89','consulta','PENDING','2026-10-14 22:25:04.041','2026-10-14 22:25:04.041',7,1,NULL),(3,'CLINIC','2026-10-16 10:00:00.000',30,NULL,NULL,'PENDING','2026-10-15 13:10:42.831','2026-10-15 13:10:42.831',4,1,NULL),(4,'HOME','2026-10-15 14:30:00.000',30,'cra 333',NULL,'PENDING','2026-10-15 13:19:17.528','2026-10-15 13:19:17.528',4,2,4);
/*!40000 ALTER TABLE `Appointment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Availability`
--

DROP TABLE IF EXISTS `Availability`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Availability` (
  `id` int NOT NULL AUTO_INCREMENT,
  `weekday` int NOT NULL,
  `startTime` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `endTime` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `vetProfileId` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Availability_vetProfileId_idx` (`vetProfileId`),
  CONSTRAINT `Availability_vetProfileId_fkey` FOREIGN KEY (`vetProfileId`) REFERENCES `VetProfile` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Availability`
--

LOCK TABLES `Availability` WRITE;
/*!40000 ALTER TABLE `Availability` DISABLE KEYS */;
INSERT INTO `Availability` VALUES (1,1,'09:00','13:00','2026-10-02 18:28:57.294','2026-10-02 18:28:57.294',1),(2,1,'14:00','18:00','2026-10-02 18:28:57.294','2026-10-02 18:28:57.294',1),(3,2,'09:00','13:00','2026-10-02 18:28:57.294','2026-10-02 18:28:57.294',1),(4,2,'14:00','18:00','2026-10-02 18:28:57.294','2026-10-02 18:28:57.294',1),(5,3,'09:00','13:00','2026-10-02 18:28:57.294','2026-10-02 18:28:57.294',1),(6,3,'14:00','18:00','2026-10-02 18:28:57.294','2026-10-02 18:28:57.294',1),(7,4,'09:00','13:00','2026-10-02 18:28:57.294','2026-10-02 18:28:57.294',1),(8,4,'14:00','18:00','2026-10-02 18:28:57.294','2026-10-02 18:28:57.294',1),(9,5,'09:00','13:00','2026-10-02 18:28:57.294','2026-10-02 18:28:57.294',1),(10,5,'14:00','18:00','2026-10-02 18:28:57.294','2026-10-02 18:28:57.294',1),(11,1,'09:00','13:00','2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2),(12,1,'14:00','18:00','2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2),(13,2,'09:00','13:00','2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2),(14,2,'14:00','18:00','2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2),(15,3,'09:00','13:00','2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2),(16,3,'14:00','18:00','2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2),(17,4,'09:00','13:00','2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2),(18,4,'14:00','18:00','2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2),(19,5,'09:00','13:00','2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2),(20,5,'14:00','18:00','2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2),(21,1,'09:00','13:00','2026-10-05 19:05:44.624','2026-10-05 19:05:44.624',3),(22,1,'14:00','18:00','2026-10-05 19:05:44.624','2026-10-05 19:05:44.624',3),(23,2,'09:00','13:00','2026-10-05 19:05:44.624','2026-10-05 19:05:44.624',3),(24,2,'14:00','18:00','2026-10-05 19:05:44.624','2026-10-05 19:05:44.624',3),(25,3,'09:00','13:00','2026-10-05 19:05:44.624','2026-10-05 19:05:44.624',3),(26,3,'14:00','18:00','2026-10-05 19:05:44.624','2026-10-05 19:05:44.624',3),(27,4,'09:00','13:00','2026-10-05 19:05:44.624','2026-10-05 19:05:44.624',3),(28,4,'14:00','18:00','2026-10-05 19:05:44.624','2026-10-05 19:05:44.624',3),(29,5,'09:00','13:00','2026-10-05 19:05:44.624','2026-10-05 19:05:44.624',3),(30,5,'14:00','18:00','2026-10-05 19:05:44.624','2026-10-05 19:05:44.624',3),(31,1,'09:00','13:00','2026-10-05 19:54:53.454','2026-10-05 19:54:53.454',4),(32,1,'14:00','18:00','2026-10-05 19:54:53.454','2026-10-05 19:54:53.454',4),(33,2,'09:00','13:00','2026-10-05 19:54:53.454','2026-10-05 19:54:53.454',4),(34,2,'14:00','18:00','2026-10-05 19:54:53.454','2026-10-05 19:54:53.454',4),(35,3,'09:00','13:00','2026-10-05 19:54:53.454','2026-10-05 19:54:53.454',4),(36,3,'14:00','18:00','2026-10-05 19:54:53.454','2026-10-05 19:54:53.454',4),(37,4,'09:00','13:00','2026-10-05 19:54:53.454','2026-10-05 19:54:53.454',4),(38,4,'14:00','18:00','2026-10-05 19:54:53.454','2026-10-05 19:54:53.454',4),(39,5,'09:00','13:00','2026-10-05 19:54:53.454','2026-10-05 19:54:53.454',4),(40,5,'14:00','18:00','2026-10-05 19:54:53.454','2026-10-05 19:54:53.454',4);
/*!40000 ALTER TABLE `Availability` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Pet`
--

DROP TABLE IF EXISTS `Pet`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Pet` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `species` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sex` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `birthDate` datetime(3) NOT NULL,
  `weight` decimal(6,2) DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `userId` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Pet_userId_idx` (`userId`),
  CONSTRAINT `Pet_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Pet`
--

LOCK TABLES `Pet` WRITE;
/*!40000 ALTER TABLE `Pet` DISABLE KEYS */;
/*!40000 ALTER TABLE `Pet` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Service`
--

DROP TABLE IF EXISTS `Service`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Service` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `price` decimal(10,2) NOT NULL,
  `durationMinutes` int NOT NULL DEFAULT '30',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `vetProfileId` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Service_vetProfileId_idx` (`vetProfileId`),
  CONSTRAINT `Service_vetProfileId_fkey` FOREIGN KEY (`vetProfileId`) REFERENCES `VetProfile` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Service`
--

LOCK TABLES `Service` WRITE;
/*!40000 ALTER TABLE `Service` DISABLE KEYS */;
INSERT INTO `Service` VALUES (1,'cirugía',NULL,200000.00,30,1,'2026-10-02 18:28:57.294','2026-10-02 18:28:57.294',1),(2,'Muestras sanguíneas',NULL,30000.00,30,1,'2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2),(3,'Muestras coprológicas',NULL,30000.00,30,1,'2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2),(4,'Muestras de orina',NULL,30000.00,30,1,'2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',2);
/*!40000 ALTER TABLE `Service` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `User`
--

DROP TABLE IF EXISTS `User`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `User` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('CLIENT','VETERINARIAN') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CLIENT',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `User`
--

LOCK TABLES `User` WRITE;
/*!40000 ALTER TABLE `User` DISABLE KEYS */;
INSERT INTO `User` VALUES (1,'juan cobo','jmcobo@unimayor.edu.co','$2b$10$ztepENiI2GWQGFkDFHpibulrd6Bm7xa5LhPbQRv6TNamOJmEII4gS','CLIENT','2026-10-01 22:15:09.073','2026-10-01 22:15:09.073'),(2,'Victor','victorpinto@unimayor.edu.co','$2b$10$eOaQy73Rt.WDWMyfFIHExODzdcvrLoBseKd7nV8P/.HJZZHY5qzJi','CLIENT','2026-10-02 14:39:11.849','2026-10-02 14:39:11.849'),(3,'Luisa','lfherrera@unimayor.edu.co','$2b$10$mOaaACRGrWOBctLdqaJsw.AzX60Z90kMh0ka01J09TcBiFOO9EPja','CLIENT','2026-10-02 14:39:59.332','2026-10-02 14:39:59.332'),(4,'danna sofia','dsyangana@unimayor.edu.co','$2b$10$MP5mWWKTVIV3hngAdCigPOvAetO1uj3MKW43rJo43rgxZfgmSw9xm','CLIENT','2026-10-02 16:01:47.149','2026-10-02 16:01:47.149'),(5,'danna sanjuan','dannasanjuan22@gmail.com','$2b$10$8ktBxGAwzlvpmY3STT.PH.1y1kAkYrWwLIMi4dxKochszeu5FZelG','VETERINARIAN','2026-10-02 18:28:57.294','2026-10-02 18:28:57.294'),(6,'danna yangana','dannayangana@gmail.com','$2b$10$C0sqkSqcTlta6QCzwNtccelbXTLmDR1BGydWsm3kitRMmlhEJW4/K','VETERINARIAN','2026-10-02 19:05:26.597','2026-10-02 19:05:26.597'),(7,'Karen Martinez','karenvale@gmail.com','$2b$10$NszrDw8A0bL4WtopinxcqO/OMVUQCg7ifa2aprF2mniehORDoeUaK','CLIENT','2026-10-05 18:51:45.658','2026-10-05 18:51:45.658'),(8,'Karen valencia','tatianavale@gmail.com','$2b$10$Ebdl5CRxYRLM4Mu/FNeRjuWBdGoAY7B2Lb4ZrSooKCDytdaD8/HAi','VETERINARIAN','2026-10-05 19:05:44.624','2026-10-05 19:05:44.624'),(9,'LUISA HERRERA','luisa@gmail.com','$2b$10$bccWWZ1d8A5vxHI3GuWJZe6Duy2gJXk81baaQ6yEhQZLjl1U3UmWy','VETERINARIAN','2026-10-05 19:54:53.454','2026-10-05 19:54:53.454'),(10,'sofia sanjuan','dannayanagana@gmail.com','$2b$10$IUOdJ05j4BKLUbrdbDZGLOZ10l0fimh6s6eQfudQozX7et/J3AYRi','CLIENT','2026-10-15 13:08:19.133','2026-10-15 13:08:19.133');
/*!40000 ALTER TABLE `User` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `VetProfile`
--

DROP TABLE IF EXISTS `VetProfile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `VetProfile` (
  `id` int NOT NULL AUTO_INCREMENT,
  `license` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specialty` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bio` text COLLATE utf8mb4_unicode_ci,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `homeService` tinyint(1) NOT NULL DEFAULT '0',
  `clinicService` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `userId` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `VetProfile_license_key` (`license`),
  UNIQUE KEY `VetProfile_userId_key` (`userId`),
  CONSTRAINT `VetProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `VetProfile`
--

LOCK TABLES `VetProfile` WRITE;
/*!40000 ALTER TABLE `VetProfile` DISABLE KEYS */;
INSERT INTO `VetProfile` VALUES (1,'MV-1234','cirujana','mas de tres años de experiencia','3166138081','calle 60 norte 51a',1,1,'2026-10-02 18:28:57.294','2026-10-02 18:28:57.294',5),(2,'MV-12345','Toma de Muestras','Mi misión es cuidar la salud de tu mascota evitando el estrés de las salas de espera. Me especializo en la recolección precisa y sin dolor de muestras biológicas (sangre, orina, coprológicos y citologías) directamente en la comodidad y tranquilidad de tu hogar.','3107060839',NULL,1,0,'2026-10-02 19:05:26.597','2026-10-02 19:05:26.597',6),(3,'MV-876','Medicina general',NULL,'3000876798','carrera 7 #34-0',0,1,'2026-10-05 19:05:44.624','2026-10-05 19:05:44.624',8),(4,'MV-8765','Medicina general',NULL,'767887899','CARRERA 10 #98-76',0,1,'2026-10-05 19:54:53.454','2026-10-05 19:54:53.454',9);
/*!40000 ALTER TABLE `VetProfile` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-20 23:56:11
