#!/bin/bash
# Levanta MySQL 8 para la integracion continua y espera a que acepte conexiones.
set -e
docker run -d --name mysql-ci   -e MYSQL_ROOT_PASSWORD=ci_password   -e MYSQL_DATABASE=animalcare_ci   -p 3306:3306   mysql:8.0 --lower-case-table-names=1

for i in $(seq 1 60); do
  if docker exec mysql-ci mysql -h127.0.0.1 -uroot -pci_password -e "select 1" > /dev/null 2>&1; then
    echo "MySQL listo"
    exit 0
  fi
  sleep 2
done
echo "MySQL no arranco a tiempo"
docker logs mysql-ci || true
exit 1
