FROM mysql:latest

#COPY my_custom.cnf /etc/mysql/my.cnf  # shelve this in case mysql optimization is needed

COPY init-db.sql /docker-entrypoint-initdb.d/

EXPOSE 3306