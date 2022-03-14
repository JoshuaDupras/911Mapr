CREATE DATABASE  IF NOT EXISTS `incident_db`;

USE `incident_db`;

CREATE TABLE IF NOT EXISTS `incidents`
(
    `uid`           int       NOT NULL AUTO_INCREMENT,
    `timestamp`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `title`         varchar(200)       DEFAULT NULL,
    `published`     timestamp NULL DEFAULT NULL,
    `inc_id_status` varchar(100)       DEFAULT NULL,
    `inc_id`        varchar(50)        DEFAULT NULL,
    `status`        varchar(50)        DEFAULT NULL,
    `geo_lat`       decimal(6, 4)      DEFAULT NULL,
    `geo_lon`       decimal(7, 4)      DEFAULT NULL,
    PRIMARY KEY (`uid`),
    UNIQUE KEY `uid_UNIQUE` (`uid`),
    UNIQUE KEY `inc_id_status_UNIQUE` (`inc_id_status`)
);
