FROM mysql:latest

COPY my_custom.cnf /etc/mysql/my.cnf

COPY init-db.sql /docker-entrypoint-initdb.d/

EXPOSE 3306